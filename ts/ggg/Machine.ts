import { GGG, GGGFail, Hooks, Token, TokenArg, Command, Commands, HookArgs, CasedString, Primitive, CommandDecision } from "./Language"
import ParseLines, { ParseLinesArgs } from "./ParseLines"
import { EventEmitter } from "../common/events"
import { isArray, isNumber, isString, isBoolean, isDefined } from "../common/util"
import NamedList, { NamedListItem } from "./NamedList"
import { SolveOptions, Solve } from "./Solve"

type QueueItem = {
  callback?: () => void
  line?: Token
  running?: Promise<any>|null
  ref?: object
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
  commandState:{ [key:string]:any } = {}
  stack:StackItem[] = []
  queue:QueueItem[] = []
  queuePointer:number = 0
  runningCommand:Command|null = null
  // Request id (the O<id> arg) echoed on this line's return so it can be
  // correlated; defaults to 1, which renders the terminator as OK.
  requestId:number = 1
  registers:Map<object,NamedList<gggRegister>> = new Map<object,NamedList<gggRegister>>()

  timeout:ReturnType<typeof setTimeout>|null = null

  constructor( props:MachineProps = {} ) {
    super()
    if ( props.commands ) {
      this.addCommands( props.commands )
    }

    this.state = props.state ? props.state : {}
    this.limits = props.limits ? props.limits : {}
  }


  write( code:string ) {
    this.run( code )
  }

  addCommands( data: { [key:string]: Command } ) {
    for ( const key in data ) {
      this.commands[key] = data[key]
    }
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
    const items:QueueItem[] = parsed.map( line => ( { line } ) )
    if ( limits.maxQueue && queue.length + items.length > limits.maxQueue ) {
      this.outputFail( GGGFail.QueueOverflow )
      return
    }
    queue.splice( queuePointer + 1, 0, ...items )
  }

  // Write a scalar into the iteration register (a single-element Matrix,
  // addressable by name or index) so a loop body can read it as $name / $index.
  setIterRegister( id:string|number, value:number ) {
    const list = this.getRegisterList( Matrix )
    let reg = ( ( typeof id === "string" ) ? list.named[id] : list.list[id] ) as Matrix | undefined
    if ( !reg ) {
      reg = new Matrix( { dim: [1], data: [value] } )
      list.add( reg, ( typeof id === "string" ) ? { name: id } : { index: id } )
    } else {
      reg.write( [value] )
    }
  }

  // Run a captured body once per value, writing each value into the iteration
  // register immediately before its body copy so the body reads the current
  // value via a reference. Writes are interleaved as callback queue items so
  // each pass sees its own value. Bounded by limits.maxQueue.
  enqueueLoop( values:number[], body:string[], id:string|number|undefined ) {
    const { queue, queuePointer, limits } = this
    const bodyLines = ParseLines( body.join( GGG.End ) )
    const items:QueueItem[] = []
    for ( const value of values ) {
      if ( id !== undefined ) {
        const regId = id
        items.push( { callback: () => this.setIterRegister( regId, value ) } )
      }
      for ( const line of bodyLines ) {
        items.push( { line } )
      }
    }
    if ( limits.maxQueue && queue.length + items.length > limits.maxQueue ) {
      this.outputFail( GGGFail.LoopOverflow )
      return
    }
    queue.splice( queuePointer + 1, 0, ...items )
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