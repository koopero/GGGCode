import { EventEmitter } from "../common/events"
import { isFunction, isObject, isString } from "../common/util"
import Format from "../ggg/Format"
import { GGG, gggToken } from "../ggg/gggLang"
import Machine from "../ggg/Machine"
import ParseLine from "../ggg/ParseLine"
import { Duplex } from "stream"

type RunArg = string
type RunOptions = {
  timeout?: number
  addOkay?: boolean
  expectOkay?: boolean
  resultFilter?: LineQuery
  endFilter?: LineQuery
}
type RunResult = { stdout: string, stderr: string }

type LineQuery = boolean | string | number | RegExp | (( code:string ) => boolean)

type LineStreamQueueItem = {
  resultFilter: LineQuery
  endFilter: LineQuery
  cmd: string
  status?: 'ok' | 'timeout' | 'error'
  resolve?: ( result: LineStreamQueueItem ) => void
  timer?: NodeJS.Timeout
  result: gggToken[]
  timeout: number
  timeoutActual: number
}

const now = () => new Date().getTime()



function lineIsEndOfCommand( line: string, options: RunOptions ) {
  return line == "ok"
}

type RunnerOptions = {
  machine?: Machine

}

class RunnerStream extends Duplex {
  _read( size ) {
    console.log('read', size )
  }

  _write( chunk, encoding, callback ) {
    console.log('write', chunk, encoding )
    callback()
  }
}

function codeMatches( code: string, query: LineQuery ) {
  if ( query === true ) {
    return true
  } else if ( isString( query ) ) {
    return code.startsWith( query )
  } else if ( isFunction( query ) ) {
    return query( code )
  } else if ( query instanceof RegExp ) {
    return query.test( code )
  }
  return false
}

export class Runner extends EventEmitter {

  running: LineStreamQueueItem | null = null
  queue: LineStreamQueueItem[] = []
  accum: string = ""
  stream = new RunnerStream()

  constructor( options: RunnerOptions = {} ) {
    super()
    const { machine } = options
    if ( machine ) {
     this.attachMachine( machine )
    }
  }

  attachMachine( machine: Machine ) {
    machine.on("output", line => this.onOutput( line ) )
    this.on("output", ( line ) => {
      console.log("machine_write", line )
      machine.run( line )
    })
  }

  async run( cmd: RunArg, options: RunOptions = {} ): Promise<LineStreamQueueItem> {
    const { timeout = 1000 } = options
    const [ prefix ] = cmd.split(' ')
    cmd = cmd.trim()+"\n"
    const result = await new Promise<LineStreamQueueItem>( ( resolve, reject ) => {
      let { resultFilter = true, endFilter = "O" } = options

      const item = {
        resultFilter,
        endFilter,
        prefix,
        cmd,
        resolve,
        result: [],
        timeout: now() + timeout,
        timeoutActual: timeout,
      }
      this.queue.push( item )

      setImmediate( () => this.tick() )
    }) 

    return result
  }

  write( str: string ) {
    console.log('write', str )
    this.emit('output', str )
  }

  onOutput( line ) {
    if ( isObject( line ) ) {
      this.onResponseToken( line )
    } else if ( isString( line ) ) {
      this.accum += line
      do {
        let index = this.accum.indexOf( GGG.End)
        if ( index == -1 ) {
          break
        }
        const line = this.accum.substring( 0, index )
        this.accum = this.accum.substring( index + 1 )
        const [ token ] = ParseLine( line )
        this.onResponseToken( token )
      } while( 1)
    }
  }

  onResponseToken( item:gggToken ) {
    const { running } = this
    const { code = "" } = item

    // console.log("onResponseToken", code )

    if ( running ) {
      const { resultFilter, endFilter } = running

      if ( codeMatches( code, resultFilter ) ) {
        running.result.push( item )
      }

      if ( codeMatches( code, endFilter ) ) {
        const { resolve } = running
        running.status = 'ok'
        delete running.resolve
        resolve && resolve( running )
        this.running = null
      }
    }
  }

  tick() {
    let { running } = this
    if ( running ) {
      const { timeout } = running
      if ( timeout && timeout < now() ) {
        const { resolve } = running
        running.status = 'timeout'
        delete running.resolve

        if ( running.timer ) {
          clearTimeout( running.timer )
          delete running.timer
        }

        resolve && resolve( running )
        this.running = null
      } else if ( timeout ) {
        running.timer = setTimeout( ()=>this.tick(), timeout - now() )
        return
      } else {
        return
      }
    }

    const { queue } = this
    const next = queue.shift()
    if ( next ) {
      const { cmd, timeout } = next
      this.write( `${cmd}\n`)
      this.running = next
      setTimeout( ()=>this.tick(), timeout - now() )
    }
  }
}


