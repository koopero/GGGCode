import { EventEmitter } from "../common/events"
import { isFunction, isObject, isString } from "../common/util"
import Format from "../ggg/Format"
import { GGG, Token } from "../ggg/Language"
import Machine from "../ggg/Machine"
import ParseLine from "../ggg/ParseLine"

//
// Runner: the canonical GGG request/response driver. You `run(cmd)`, it sends
// each command line, collects the response lines that match `resultFilter`, and
// resolves when a line matches `endFilter` (the OK terminator by default) or the
// timeout fires. Transport-agnostic: outbound goes through a `write` callback
// (or the "output" event); inbound is pushed in via `feed()`. `attachMachine()`
// wires it to an in-process Machine for loopback testing.
//

type LineQuery = boolean | string | number | RegExp | (( key: string ) => boolean )

export type RunStatus = "ok" | "fail" | "timeout"

export type RunOptions = {
  timeout?: number              // ms; 0 disables the timeout
  resultFilter?: LineQuery      // which response lines to collect (default: all)
  endFilter?: LineQuery         // which response line ends the command (default: OK)
}

export type RunResult = {
  cmd: string
  status: RunStatus
  lines: string[]               // raw response lines (excluding the terminator)
  tokens: Token[]               // the same lines, parsed
}

export type RunnerOptions = {
  machine?: Machine
  write?: ( str: string ) => void
}

type QueueItem = {
  cmd: string
  resultFilter: LineQuery
  endFilter: LineQuery
  timeout: number               // absolute deadline (ms epoch); 0 = none
  lines: string[]
  tokens: Token[]
  resolve?: ( result: RunResult ) => void
  timer?: ReturnType<typeof setTimeout>
}

const now = () => Date.now()
const soon = ( fn: () => void ) => setTimeout( fn, 0 )

// Default end-of-response matcher: the GGG OK terminator is any command/code
// beginning with GGG.Okay ("O") -- OK / O1 / O0 / ON. Mirrors the C++ outputOk()
// and the client isOkay() helper.
const defaultEndFilter: LineQuery = ( key: string ) => key.startsWith( GGG.Okay )

function codeMatches( key: string, query: LineQuery ): boolean {
  if ( query === true ) return true
  if ( query === false ) return false
  if ( isString( query ) ) return key.startsWith( query )
  if ( isFunction( query ) ) return query( key )
  if ( query instanceof RegExp ) return query.test( key )
  return false
}

// A line carries a command (vs. a bare comment / blank) if its pre-comment part
// starts with a letter.
function lineIsCommand( line: string ): boolean {
  const [ beforeComment ] = line.split( GGG.Comment )
  return /^\s*[a-zA-Z]/.test( beforeComment )
}

// A response line's match key is its command (from ParseLine over the wire) or
// its code (from a Machine emitting Token objects in loopback).
function tokenKey( token: Token ): string {
  return token.command || token.code || ""
}

export class Runner extends EventEmitter {

  running: QueueItem | null = null
  queue: QueueItem[] = []
  accum: string = ""
  private writeCb?: ( str: string ) => void

  constructor( options: RunnerOptions = {} ) {
    super()
    const { machine, write } = options
    if ( write ) this.writeCb = write
    if ( machine ) this.attachMachine( machine )
  }

  // In-process loopback: feed commands into a Machine and take its output back
  // as responses.
  attachMachine( machine: Machine ) {
    machine.on( "output", ( out: string | Token ) => this.feed( out ) )
    if ( !this.writeCb ) this.writeCb = ( line ) => machine.run( line )
  }

  // Queue each non-comment line as its own command; resolve one RunResult each.
  async run( cmd: string, options: RunOptions = {} ): Promise<RunResult[]> {
    const { timeout = 1000, resultFilter = true, endFilter = defaultEndFilter } = options

    const results = cmd
      .split( "\n" )
      .map( l => l.trim() )
      .filter( lineIsCommand )
      .map( line => new Promise<RunResult>( resolve => {
        this.queue.push( {
          cmd: line + "\n",
          resultFilter,
          endFilter,
          timeout: timeout ? now() + timeout : 0,
          lines: [],
          tokens: [],
          resolve,
        } )
      } ) )

    soon( () => this.tick() )
    return Promise.all( results )
  }

  // Push device output in: a raw text chunk / line(s), or a Token object (the
  // shape a Machine emits in loopback).
  feed( input: string | Token ) {
    if ( isString( input ) ) {
      this.accum += input
      for ( ;; ) {
        const index = this.accum.indexOf( GGG.End )
        if ( index === -1 ) break
        const raw = this.accum.substring( 0, index )
        this.accum = this.accum.substring( index + 1 )
        const [ token ] = ParseLine( raw )
        this.onResponse( token, raw )
      }
    } else if ( isObject( input ) ) {
      const token = input as Token
      this.onResponse( token, Format( token ) )
    }
  }

  private send( str: string ) {
    if ( this.writeCb ) this.writeCb( str )
    this.emit( "output", str )
  }

  private onResponse( token: Token, raw: string ) {
    const { running } = this
    if ( !running ) return

    const key = tokenKey( token )

    if ( codeMatches( key, running.endFilter ) ) {
      // Terminator: end the command without collecting it as a result line.
      // A failure return carries an F<code> arg (before any comment); its
      // presence -- not the echoed O<id> -- is what marks failure. The id is
      // available on the terminator for future out-of-order correlation, which
      // would replace this FIFO `running` with an id lookup.
      const beforeComment = raw.split( GGG.Comment )[0]
      const failed = beforeComment.trim().split( " " ).some( a => a[0] === GGG.Failure )
      this.finish( running, failed ? "fail" : "ok" )
      return
    }

    if ( codeMatches( key, running.resultFilter ) ) {
      running.lines.push( raw )
      running.tokens.push( token )
    }
  }

  private finish( item: QueueItem, status: RunStatus ) {
    if ( item.timer ) {
      clearTimeout( item.timer )
      delete item.timer
    }
    const { resolve } = item
    delete item.resolve
    this.running = null
    resolve && resolve( { cmd: item.cmd, status, lines: item.lines, tokens: item.tokens } )
    soon( () => this.tick() )
  }

  private tick() {
    if ( this.running ) return

    const next = this.queue.shift()
    if ( !next ) return

    this.running = next
    if ( next.timeout ) {
      next.timer = setTimeout(
        () => { if ( this.running === next ) this.finish( next, "timeout" ) },
        Math.max( 0, next.timeout - now() ),
      )
    }
    this.send( next.cmd )
  }
}
