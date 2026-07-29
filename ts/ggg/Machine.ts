import { GGG, GGGFail, Hooks, Token, TokenArg, Command, Commands, HookArgs, CasedString, Primitive, CommandDecision } from "./Language"
import ParseLines, { ParseLinesArgs } from "./ParseLines"
import { EventEmitter } from "../common/events"
import { isArray, isNumber, isString, isBoolean, isDefined } from "../common/util"
import NamedList, { NamedListItem } from "./NamedList"
import { SolveOptions, Solve } from "./Solve"
import type { EnumDomain } from "./EnumRepository"

type QueueItem = {
  callback?: () => void
  line?: Token
  running?: Promise<any>|null
  ref?: object
  // Enqueued by the MACHINE (a procedure body), not fed by the host. Only this
  // counts against the work budget, so the budget measures re-entrant work in
  // both engines: C++ feeds host input straight to parse(), so its counter
  // never sees it either.
  work?: boolean
}

type StackItem = {
  command:Command,
  state:{ [key:string]:any },
  pointer?: QueueItem,
  capture?: string[],
  depth?: number,
}

type gggRegister = NamedListItem

type MachineRegisterList = NamedList<gggRegister>



type MachineProps = {
  commands?: Commands
  state?:{ [key:string]:any }
  limits?:MachineLimits
}


enum MachineEvents {
  Output = "output",
  Fail = "fail",
}

export enum gggMessage {
  CommandNotFound = "Command not found",
}

export type MachineLimits = {
  maxRegisters?:number
  maxRegisterSize?:number
  maxQueue?:number
  maxArgs?:number
  maxAsync?:number
}

// One scheduled async procedure (see poll). nextDue is undefined until the first
// poll: at export time the machine has no clock, so the schedule cannot start
// until the host supplies a `now`. remaining is undefined for an unbounded
// export -- the whole point of the feature, since the host, not the language,
// decides when to stop granting ticks.
export type AsyncProcedure = {
  name:string
  // The body register itself, not its name: the core has no knowledge of the
  // gggtx procedure vocabulary, and holding the object means a T10 redefine is
  // picked up by an already-scheduled export.
  body:{ lines?:string[] }
  interval:number
  remaining?:number
  nextDue?:number
}

function isBlankCommand( command:string ) {
  const compare = CasedString( command.trim() )
  return !compare || compare.startsWith( GGG.Okay )
}

import Matrix from "./Matrix"
import { FormatOkayNumber } from "./Format"


type MachineSolve = ( arg:Primitive|Primitive[], options? ) => Generator<number|string>

export default class Machine extends EventEmitter  {
  state:{ [key:string]:any } = {}

  limits:MachineLimits = {}
  
  commands:Commands = {}
  // All protocol message schemas known to this machine: executable commands
  // plus non-executable result records such as D-40 and D-51.
  messages:Record<string,Command> = {}
  // Machine-scoped because extensions and live reference domains vary by the
  // commands/registers loaded into this particular runtime.
  enumDomains:NamedList<EnumDomain> = new NamedList<EnumDomain>()
  commandState:{ [key:string]:any } = {}
  stack:StackItem[] = []
  queue:QueueItem[] = []
  queuePointer:number = 0
  // Work executed since the host last fed the machine. Depth-first re-insertion
  // keeps the queue SHALLOW during recursion, so a depth check alone never
  // catches a procedure that runs itself -- the total-work budget does. Reset
  // per drive (run/poll); mirrors the `processed` counter in C++ drainPending.
  queueWork:number = 0
  runningCommand:Command|null = null
  // Request id (the O<id> arg) echoed on this line's return so it can be
  // correlated; defaults to 1, which renders the terminator as OK.
  requestId:number = 1
  registers:Map<object,NamedList<gggRegister>> = new Map<object,NamedList<gggRegister>>()

  // Procedures exported as asynchronous (T12), fired by the host through poll().
  // Insertion-ordered: due procedures run in the order they were exported.
  schedule:AsyncProcedure[] = []

  timeout:ReturnType<typeof setTimeout>|null = null

  constructor( props:MachineProps = {} ) {
    super()
    if ( props.commands ) {
      this.addCommands( props.commands )
    }

    this.state = props.state ? props.state : {}
    // Defaults matter: the guards are written `if ( limits.maxQueue && ... )`,
    // so an absent limit silently DISABLES them. These mirror the generated C++
    // defaults in cxx/include/ggg/Limits.h (source: ts/cxx/CxxLimits.ts).
    this.limits = { maxQueue: 1024, maxAsync: 16, ...( props.limits || {} ) }
  }


  write( code:string ) {
    this.run( code )
  }

  addCommands( data: { [key:string]: Command } ) {
    for ( const key in data ) {
      const command = data[key]
      this.commands[key] = command
      this.addMessage( key, command )
    }
  }

  addMessage( key:string, message:Command ) {
    this.messages[key] = message
    for ( const domain of message.domains || [] ) this.addEnumDomain( domain )
    for ( const arg of Object.values( message.args || {} ) ) {
      if ( arg.domain ) this.addEnumDomain( arg.domain )
    }
    for ( const recordKey in message.records || {} ) {
      this.addMessage( recordKey, message.records![recordKey] as Command )
    }
  }

  addEnumDomain( domain:EnumDomain ) {
    const byIndex = this.enumDomains.get( domain.index )
    const byName = this.enumDomains.get( domain.name )
    if ( byIndex && byIndex !== domain ) {
      throw new Error( `Enum group index ${domain.index} is already owned by ${byIndex.name}` )
    }
    if ( byName && byName !== domain ) {
      throw new Error( `Enum group name ${domain.name} is already owned by index ${byName.index}` )
    }
    if ( !byIndex && !byName ) this.enumDomains.add( domain )
  }

  output( tokens: string | string[] | Token | Token[] ) {
    if ( isArray( tokens ) ) {
      for ( const token of tokens ) {
        this.emit( MachineEvents.Output, token )
      }
    } else {
      this.emit( MachineEvents.Output, tokens )
    }
  }

  // Success return: the O<id> terminator. The id renders via FormatOkayNumber,
  // so the default id 1 still reads OK.
  outputOk( comment?:string ) {
    this.output( { code: `${GGG.Okay}${FormatOkayNumber( this.requestId )}`, comment, eol: true } )
  }

  // Failure return: the same O<id> terminator plus an F<code> arg (and optional
  // comment). The presence of the F arg -- not the id -- is what signals failure.
  outputFail( code:number, comment?:string ) {
    this.output( {
      code: `${GGG.Okay}${FormatOkayNumber( this.requestId )}`,
      args: [ { code: `${GGG.Failure}${code}` } ],
      comment,
      eol: true,
    } )
  }

  tick() {
    this.timeout = null
    const { queue, queuePointer } = this
    const item = queue[queuePointer]
    const next = () => {
      this.queuePointer++
      if ( !this.timeout ) {
        this.timeout = setTimeout( () => this.tick(), 0 )
      }
    }

    if ( item ) {
      const { running, callback, line } = item
      if ( running ) return
      if ( callback ) {
        callback()
        return next()
      }

      const { limits } = this
      if ( line && item.work && limits.maxQueue && ++this.queueWork > limits.maxQueue ) {
        // Budget spent: drop the queued WORK and report, rather than letting a
        // self-running procedure spin forever. Callbacks are kept -- run()/poll()
        // resolve through a sentinel callback, so removing those would swap a
        // spin for a promise that never settles.
        for ( let i = queue.length - 1; i >= queuePointer; i-- ) {
          if ( queue[i].line ) queue.splice( i, 1 )
        }
        this.queueWork = 0
        this.outputFail( GGGFail.QueueOverflow )
        // queuePointer now addresses the next surviving item; keep draining it.
        if ( !this.timeout ) this.timeout = setTimeout( () => this.tick(), 0 )
        return
      }

      if ( line ) {
        item.running = new Promise<void>( ( resolve ) => {
          this.execLine( line )
            .then(  () => {
              item.running = null
              resolve()
              next()
            })
        })
      }
    }
  }


  // --- Control frames ---------------------------------------------------
  // A frame's command exposes a Hooks.Stack hook that, before each subsequent
  // command is dispatched, returns a CommandDecision (run/capture/skip/error).
  // Flow-control commands (gggtx T-series) push/pop frames to capture and
  // re-run source. See execLine for the gate.

  pushFrame( frame:StackItem ) {
    this.stack.push( frame )
  }

  popFrame() : StackItem | undefined {
    return this.stack.pop()
  }

  // Splice parsed source lines into the queue so they run immediately after the
  // current item. Bounded by limits.maxQueue to keep recursion/queue growth in
  // check; on overflow the lines are dropped and a failure return is emitted.
  enqueueLines( lines:string[] ) {
    const { queue, queuePointer, limits } = this
    const parsed = ParseLines( lines.join( GGG.End ) )
    const items:QueueItem[] = parsed.map( line => ( { line, work: true } ) )
    // Outstanding depth, not queue.length: consumed items are never removed from
    // the array (queuePointer just advances), so length is a lifetime total and
    // would cap a long session. Mirrors the C++ pending.size() check.
    if ( limits.maxQueue && ( queue.length - queuePointer ) + items.length > limits.maxQueue ) {
      this.outputFail( GGGFail.QueueOverflow )
      return
    }
    queue.splice( queuePointer + 1, 0, ...items )
  }

  // Write a scalar at a flat offset in the iteration register, addressable by
  // name or index. An on-demand register is sized through that offset.
  setIterRegister( id:string|number, value:number, offset:number = 0 ) {
    const list = this.getRegisterList( Matrix )
    let reg = ( ( typeof id === "string" ) ? list.named[id] : list.list[id] ) as Matrix | undefined
    offset = Math.trunc( offset )
    if ( !reg ) {
      const size = Math.max( 1, offset + 1 )
      reg = new Matrix( { dim: [size], data: new Array( size ).fill( 0 ) } )
      list.add( reg, ( typeof id === "string" ) ? { name: id } : { index: id } )
    }
    reg.write( [value], offset )
  }

  // Run a captured body once per value, writing each value into the iteration
  // register immediately before its body copy so the body reads the current
  // value via a reference. Writes are interleaved as callback queue items so
  // each pass sees its own value. Bounded by limits.maxQueue.
  enqueueLoop(
    values:number[],
    body:string[],
    id:string|number|undefined,
    offset:number = 0
  ) {
    const { queue, queuePointer, limits } = this
    const bodyLines = ParseLines( body.join( GGG.End ) )
    const items:QueueItem[] = []
    for ( const value of values ) {
      if ( id !== undefined ) {
        const regId = id
        const regOffset = offset
        items.push( { callback: () => this.setIterRegister( regId, value, regOffset ) } )
      }
      for ( const line of bodyLines ) {
        items.push( { line, work: true } )
      }
    }
    if ( limits.maxQueue && ( queue.length - queuePointer ) + items.length > limits.maxQueue ) {
      this.outputFail( GGGFail.LoopOverflow )
      return
    }
    queue.splice( queuePointer + 1, 0, ...items )
  }

  // --- Async procedures -------------------------------------------------
  // The language has bounded T9 V iteration but no unbounded loop construct.
  // Open-ended repetition comes from exporting a procedure (T12) and letting
  // the HOST call poll() -- so a runaway program
  // consumes host ticks the host can stop granting, instead of spinning inside
  // the parser. This is what makes the language Turing complete without making
  // it possible to hang the machine.

  // Schedule (or reschedule) a procedure. A count of 0 cancels; undefined runs
  // it indefinitely. Re-exporting an existing name replaces its schedule,
  // mirroring T10's silent redefine.
  scheduleProcedure( name:string, body:{ lines?:string[] }, interval:number, count?:number ) : boolean {
    this.cancelProcedure( name )
    if ( count === 0 ) return true            // G0 is a cancel, not a schedule
    const { limits } = this
    if ( limits.maxAsync && this.schedule.length >= limits.maxAsync ) {
      this.outputFail( GGGFail.QueueOverflow )
      return false
    }
    this.schedule.push( { name, body, interval, remaining: count } )
    return true
  }

  cancelProcedure( name:string ) {
    this.schedule = this.schedule.filter( entry => entry.name !== name )
  }

  // Fire every procedure whose interval has elapsed, and resolve once their
  // bodies have drained. Each due procedure fires AT MOST ONCE per poll: after a
  // long gap the next deadline is rebased on `now` rather than catching up, so a
  // late host cannot trigger a burst of queued bodies.
  async poll( now:number ) : Promise<number> {
    this.queueWork = 0            // fresh budget per host drive
    let fired = 0

    for ( const entry of this.schedule.slice() ) {
      if ( entry.nextDue === undefined ) {
        // First sight of this entry: the schedule starts from the host's clock.
        entry.nextDue = now + entry.interval
        if ( entry.interval > 0 ) continue
      }
      if ( now < entry.nextDue ) continue

      const lines = entry.body.lines
      if ( !lines ) {
        this.cancelProcedure( entry.name )
        continue
      }

      entry.nextDue = now + entry.interval
      if ( entry.remaining !== undefined ) {
        entry.remaining--
        if ( entry.remaining <= 0 ) this.cancelProcedure( entry.name )
      }

      this.enqueueLines( lines )
      fired++
    }

    if ( fired ) await this.drain()
    return fired
  }

  // Resolve once everything currently queued has run. Same sentinel-callback
  // trick as run(): push a marker and wait for the queue to reach it.
  drain() : Promise<void> {
    return new Promise<void>( resolve => {
      this.queue.push( { callback: () => resolve() } )
      this.tick()
    } )
  }

  getRegisterList( registerClass:object ) : NamedList<gggRegister> {
    let registers = this.registers.get( registerClass )
    if ( !registers ) {
      registers = new NamedList<gggRegister>()
      this.registers.set( registerClass, registers )
    }
    return registers
  }
  

  getRegister( registerClass:object, id:string|number, defaultRegister?:gggRegister ) : gggRegister|undefined {
    let registers = this.registers.get( registerClass )

    if ( defaultRegister ) {
      if ( !registers ) {
        registers = new NamedList<gggRegister>()
        this.registers.set( registerClass, registers )
      }

      const register = registers.get( id )
      if ( !register ) {
        registers.add( defaultRegister, id )
        return defaultRegister
      }
    }

    if ( !registers ) return
    return registers.get( id )
  }

  getMatrix( id:string|number ) : Matrix|undefined {
    const register = this.getRegister( Matrix, id )
    if ( register ) {
      return register as Matrix
    }
  }

  *solve( arg:Primitive|Primitive[], options?:SolveOptions ) : Generator<number|string> {
    const MatrixResolveDefault = ( name:string ) => this.getMatrix( name )
    const { MatrixResolve = MatrixResolveDefault } = options || {}
    yield* Solve( arg, { MatrixResolve, ...options } )
  }

  async execLine( line:Token ) {
    const machine = this
    if ( line.command ) {
      const command = line.command
      if ( isBlankCommand( command ) )
        return

      // Universal request id: an O<id> arg tags this command so its return can
      // be correlated; defaults to 1 so the terminator reads OK. Reset per line
      // here -- the O arg itself is read in the dispatch block below, where we
      // can tell whether the command instead claims O as its own data arg.
      this.requestId = 1

      // Command gate: ask the top control frame what to do with this
      // now-formalized command before dispatching it.
      const { stack } = machine
      const top = stack[stack.length-1]
      let decision = CommandDecision.Run
      if ( top ) {
        const hook = top.command[Hooks.Stack]
        if ( hook ) {
          decision = ( await hook( { machine, command, state: top.state, frame: top } ) ) || CommandDecision.Run
        }
      }

      if ( decision === CommandDecision.Capture ) {
        if ( top && top.capture && line.source ) top.capture.push( line.source )
        return
      }
      if ( decision === CommandDecision.Skip ) {
        return
      }
      if ( decision === CommandDecision.Error ) {
        this.outputFail( GGGFail.StackError )
        return
      }

      const impl = this.commands[command]
      if ( impl ) {
        this.runningCommand = impl
        const state = this.commandState[command] = this.commandState[command] || {}

        // A trailing O<id> is the universal request id: capture it here (and skip
        // dispatching it below) so the command never sees the id as data. O is
        // reserved for this -- no command uses O as an arg code.
        if ( line.args ) {
          for ( const arg of line.args ) {
            if ( arg.code === GGG.Okay && isDefined( arg.data ) ) {
              for ( const value of this.solve( arg.data, { solveStrings: false } ) ) {
                if ( isNumber( value ) ) { this.requestId = Math.floor( value ); break }
              }
            }
          }
        }

        await this.execCommandHook( Hooks.Command, { machine, command, state } )

        const { args } = line
        if ( args ) {
          for ( const arg of args ) {
            const { code, data } = arg
            if ( code === GGG.Okay ) continue   // universal request id, captured above
            await this.execCommandHook( Hooks.Code, { machine, command, state, code } )

            if ( data || data === 0 ) {
              for ( const value of this.solve( data, { solveStrings: false } ) ) {
                await this.execCommandHook( Hooks.Value, { machine, command, state, code, value } )
              }
            }
            await this.execCommandHook( Hooks.EndArg, { machine, command, state, code } )
          }
        }
        await this.execCommandHook( Hooks.End, { machine, state, command } )
      } else if ( !isBlankCommand( command ) ) {
        this.outputFail( GGGFail.CommandNotFound, gggMessage.CommandNotFound )
      }
    }
  }

  async execCommandHook( hook:Hooks, arg:HookArgs ) {
    const command = this.runningCommand
    if ( !command ) return
    const func = command[hook]
    if ( !func ) return
    await func( arg )
  }

  async run( code:ParseLinesArgs ) : Promise<Token[]> {
    const { queue } = this
    this.queueWork = 0            // fresh budget per host drive
    const lines = ParseLines( code )
    const result = new Promise<Token[]>( resolve => {
      const output : Token[] = []

      const onOutput = ( line:Token ) => output.push( line )

      queue.push( { callback: () => {
        this.on( MachineEvents.Output, onOutput )
      }})
      for ( const line of lines ) {
        queue.push( { line } )
      }
      queue.push( { callback: () => {
        this.off( MachineEvents.Output, onOutput )
        resolve( output )
      }})
    })

    this.tick()
    return await result
  }
}

export type MachineHookArgs = HookArgs & {
  machine:Machine,
}
