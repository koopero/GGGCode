import { GGG, gggHooks, gggToken, gggTokenArg, gggCommand, gggCommands, gggHookArgs, gggCasedString, gggPrimitive } from "./gggLang"
import ParseLines, { ParseLinesArgs } from "./ParseLines"
import { EventEmitter } from "../common/events"
import { isArray, isNumber, isString, isBoolean, isDefined } from "../common/util"
import gggNamedList, { gggNamedListItem } from "./gggNamedList"
import { gggSolver as MachineSolver } from "../ggggx/Solve"
import GGGGX from "../ggggx/ggggxLang"

type QueueItem = {
  callback?: () => void
  line?: gggToken
  running?: Promise<any>|null
  ref?: object
}

type StackItem = {
  command:gggCommand,
  state:{ [key:string]:any },
  pointer?: QueueItem,
}

type gggRegister = gggNamedListItem

type MachineRegisterList = gggNamedList<gggRegister>



type MachineProps = {
  commands?: gggCommands
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
  const compare = gggCasedString( command.trim() )
  return !compare || compare.startsWith( GGG.Okay )
  }

import Matrix from "../ggggx/Matrix"
import { FormatOkayNumber } from "./Format"
const NumbersAspect = "numbers"
const NumbersClass = Matrix


type MachineSolver = ( arg:gggPrimitive|gggPrimitive[], options? ) => Generator<number|string>

export default class Machine extends EventEmitter  {
  state:{ [key:string]:any } = {}

  limits:MachineLimits = {}
  
  commands:gggCommands = {}
  commandState:{ [key:string]:any } = {}
  
  solvers:MachineSolver[] = []

  stack:StackItem[] = []
  queue:QueueItem[] = []
  queuePointer:number = 0
  runningCommand:gggCommand|null = null
  registers:Map<object,gggNamedList<gggRegister>> = new Map<object,gggNamedList<gggRegister>>()

  timeout:ReturnType<typeof setTimeout>|null = null
  skip:boolean = false

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

  addCommands( data: { [key:string]: gggCommand } ) {
    for ( const key in data ) {
      this.commands[key] = data[key]
    }
  }

  output( tokens: string | string[] | gggToken | gggToken[] ) {
    if ( isArray( tokens ) ) {
      for ( const token of tokens ) {
        this.emit( MachineEvents.Output, token )
      }
    } else {
      this.emit( MachineEvents.Output, tokens )
    }
  }

  outputOk( okay:number = 1, comment?:string ) {
    const code = GGG.Okay
    this.output( { code: `${code}${FormatOkayNumber(okay)}`, comment } )
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


  getRegisterList( registerClass:object ) : gggNamedList<gggRegister> {
    let registers = this.registers.get( registerClass )
    if ( !registers ) {
      registers = new gggNamedList<gggRegister>()
      this.registers.set( registerClass, registers )
    }
    return registers
  }
  

  getRegister( registerClass:object, id:string|number, defaultRegister?:gggRegister ) : gggRegister|undefined {
    let registers = this.registers.get( registerClass )

    if ( defaultRegister ) {
      if ( !registers ) {
        registers = new gggNamedList<gggRegister>()
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

  *solve( arg:gggPrimitive|gggPrimitive[], options? ) : Generator<number|string> {
    if ( !this.solvers.length ) {
      if ( isNumber( arg ) || isString( arg ) ) {
        yield arg
      } else if ( isArray( arg ) ) {
        for ( const item of arg ) {
          yield* this.solve( item )
        }
      }
      return
    }
    for ( const solver of this.solvers ) {
      yield* solver( arg, options )
    }
  }

  async execLine( line:gggToken ) {
    const machine = this
    if ( line.command ) {
      const command = line.command
      if ( isBlankCommand( command ) ) 
        return

      const { stack } = machine
      const top = stack[stack.length-1]
      if ( top ) {
        const hook = top.command[gggHooks.Stack]
        if ( hook ) {
          await hook( { machine, command, state: top.state } )
        }
      }

      const impl = this.commands[command]
      if ( impl ) {
        this.runningCommand = impl
        const state = this.commandState[command] = this.commandState[command] || {}
        await this.execCommandHook( gggHooks.Command, { machine, command, state } )

        const { args } = line
        if ( args ) {
          for ( const arg of args ) {
            const { code, data } = arg
            await this.execCommandHook( gggHooks.Code, { machine, command, state, code } )

            if ( data || data === 0 )
              for ( const value of this.solve( data ) ) {
                await this.execCommandHook( gggHooks.Value, { machine, command, state, code, value } )
              }
            await this.execCommandHook( gggHooks.EndArg, { machine, command, state, code } )
          }
        }
        await this.execCommandHook( gggHooks.End, { machine, state, command } )
      } else if ( !isBlankCommand( command ) ) {
        this.outputOk( 0, gggMessage.CommandNotFound )
      }
    }
  }

  async execCommandHook( hook:gggHooks, arg:gggHookArgs ) {
    const command = this.runningCommand
    if ( !command ) return
    const func = command[hook]
    if ( !func ) return
    await func( arg )
  }

  async run( code:ParseLinesArgs ) : Promise<gggToken[]> {
    const { queue } = this
    const lines = ParseLines( code )
    const result = new Promise<gggToken[]>( resolve => {
      const output : gggToken[] = []

      const onOutput = ( line:gggToken ) => output.push( line )

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

export type MachineHookArgs = gggHookArgs & {
  machine:Machine,
}