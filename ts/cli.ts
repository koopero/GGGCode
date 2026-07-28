

import { parseArgs } from "node:util"
import { isArray } from "./common/util"
import Machine from "./ggg/Machine"
import * as readline from "readline"
import { createReadStream, ReadStream, writeFileSync } from "fs"
import { Readable, pipeline } from 'stream'
import Format from "./ggg/Format"
import gggWebSocketServer from "./websocket/gggWebSocketServer"
import { MatrixEvents } from "./ggggx/GXLanguage"
import SavePNG from "./ggggx/SavePNG"

type OptionSpec = {
  alias: string
  describe: string
  type: "boolean" | "string"
  multiple?: boolean      // repeatable (-x p -x g); always parsed into an array
}

// The CLI option surface. Parsing is Node's built-in util.parseArgs rather than
// a dependency: optimist is abandoned and pinned a minimist with prototype-
// pollution advisories, and this drops it plus its transitives entirely.
export const CLI_OPTIONS : Record<string, OptionSpec> = {
  help:        { alias: "h", describe: "Show help",                        type: "boolean" },
  version:     { alias: "v", describe: "Show version",                     type: "boolean" },
  client:      { alias: "c", describe: "Connect to WebSocket server",      type: "string"  },
  server:      { alias: "s", describe: "Start WebSocket server",           type: "string"  },
  extension:   { alias: "x", describe: "Load builtin extension",           type: "string", multiple: true },
  all:         { alias: "a", describe: "Load all builtin extensions",      type: "boolean" },
  module:      { alias: "m", describe: "Load commands from module",        type: "string", multiple: true },
  echo:        { alias: "e", describe: "Echo input",                       type: "boolean" },
  interpreter: { alias: "i", describe: "Start interactive interpreter",    type: "boolean" },
  quiet:       { alias: "q", describe: "Don't print output",               type: "boolean" },
  ok:          { alias: "k", describe: "Print 'OK' commands",              type: "boolean" },
  output:      { alias: "o", describe: "PNG output path (%d or %04d per G13)", type: "string" },
  tick:        { alias: "t", describe: "Async poll interval, ms (default 10)", type: "string" },
}

// Parse argv into the shape the rest of runCLI expects: named options plus `_`
// for positional file arguments. strict:false keeps the old parser's leniency,
// so an unrecognized flag does not abort the run.
export function parseCLI( args:string[] ) {
  const options:any = {}
  for ( const name in CLI_OPTIONS ) {
    const spec = CLI_OPTIONS[name]
    // `multiple` must be omitted rather than undefined -- parseArgs type-checks it.
    options[name] = { type: spec.type, short: spec.alias }
    if ( spec.multiple ) options[name].multiple = true
  }
  const { values, positionals } = parseArgs( {
    args,
    options,
    allowPositionals: true,
    strict: false,
  } )
  return { ...values, _: positionals } as any
}

export function showHelp() {
  const width = Math.max( ...Object.keys( CLI_OPTIONS ).map(
    n => `--${n}, -${CLI_OPTIONS[n].alias}`.length ) )
  const lines = [ "Usage: ggg [options] [files]", "", "Options:" ]
  for ( const name in CLI_OPTIONS ) {
    const flag = `--${name}, -${CLI_OPTIONS[name].alias}`
    lines.push( `  ${flag.padEnd( width )}  ${CLI_OPTIONS[name].describe}` )
  }
  console.log( lines.join( "\n" ) )
}

// Expand a printf-style frame marker. A path without a marker is returned
// unchanged, preserving the convenient "latest frame" overwrite behaviour.
export function formatOutputPath( template:string, sequence:number ) {
  return template.replace( /%%|%0(\d+)d|%d/g, ( marker, width ) => {
    if ( marker === "%%" ) return "%"
    const value = sequence.toString()
    return width ? value.padStart( Number( width ), "0" ) : value
  } )
}

export function attachPNGOutput( machine:Machine, template:string ) {
  let sequence = 0
  machine.on( MatrixEvents.Display, ( { buffer } ) => {
    const path = formatOutputPath( template, sequence++ )
    writeFileSync( path, SavePNG( buffer ) )
  } )
}


// Canonical names of every built-in extension, in load order. Used by the
// `--all` / `-a` option to load them all.
const builtinExtensions = [ "gggpx", "ggggx", "gggtx", "gggdx" ]

function loadCommandsFromBuiltinExtension( name:string ) {
  switch( name ) {
    case "d":
    case "gggdx":
      return require("./gggdx/DocCommands").default

    case "g":
    case "ggggx":
      return require("./ggggx/GXCommands").GXCommands

    case "t":
    case "gggtx":
      return require("./gggtx/gggtxCommands").default

    case "p":
    case "gggpx":
      return require("./gggpx/PrintCommands").default
  }

  throw new Error(`Built-in extension not found: ${name}`)
}



export function runCLI() {
  const options = parseCLI( process.argv.slice( 2 ) )

  if ( options.help ) {
    showHelp()
    process.exit(0)
  }

  if ( options.version ) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    console.log( require("../../package.json").version )
    process.exit(0)
  }

  let commands = {}

  if ( options.all ) {
    builtinExtensions.forEach( name => {
      commands = { ...commands, ...loadCommandsFromBuiltinExtension( name ) }
    })
  }

  if ( options.extension ) {
    const extension = isArray( options.extension ) ? options.extension : [ options.extension ]
    extension.forEach( name => {
      try {
        const addCommands = loadCommandsFromBuiltinExtension( name )
        commands = { ...commands, ...addCommands }
      } catch( e ) {
        console.error( "; "+e.message )
        process.exit(1)
      }
    })
  }

  if ( options.module ) {
    const module = isArray( options.module ) ? options.module : [ options.module ]
    module.forEach( name => {
      try {
        if ( name[0] !== "." && name[0] !== "/" ) {
          name = "./"+name
        } 
        const addCommands = require( name ).default
        commands = { ...commands, ...addCommands }
      } catch( e ) {
        console.error( "; "+e.message )
        process.exit(1)
      }
    })
  }

  const state = {}

  function machineGenerator() {
    const machine = new Machine( { commands, state } )
    return machine
  }

  const machine = machineGenerator()

  machine.on( "output", token => {
    if ( options.quiet )
      return
    // Newline termination is intrinsic to the token (eol flag, handled by
    // Format) — complete-line tokens self-terminate, string fragments don't.
    process.stdout.write( Format( token ) )
  })

  if ( options.output ) {
    attachPNGOutput( machine, options.output )
  }

  const files = options._
  let inputStream:Readable = process.stdin

  if ( files.length ) {
    // Example usage
    const streams = files.map(path => createReadStream(path))

    if ( options.interpreter ) {
      streams.push( process.stdin )
    }

    inputStream = concatenateStreams(streams)
  }

  const rl = readline.createInterface({
    input: inputStream,
    output: process.stdout,
    terminal: false
  })

  const processLine = (line: string) => {
    machine.run( line )
  }

  rl.on('line', (line) => {
    processLine(line)
  })

  // Async procedures (T12) are run by the HOST, not the language, so the CLI has
  // to drive them. The ticker also governs process lifetime: a script that
  // exports ten blinks should finish them before exiting, so polling continues
  // while anything is scheduled and stops once input has ended and the schedule
  // is empty -- which lets a plain script exit promptly instead of hanging on a
  // live timer.
  //
  // NB: --server builds a separate machine per connection via machineGenerator;
  // those are not polled by this ticker.
  const tickMs = Number( options.tick ) > 0 ? Number( options.tick ) : 10
  let inputEnded = false
  let polling = false
  const ticker = setInterval( () => {
    if ( polling ) return               // poll() is async; never overlap two drives
    polling = true
    machine.poll( Date.now() )
      .catch( e => console.error( "; " + e.message ) )
      .then( () => {
        polling = false
        if ( inputEnded && !machine.schedule.length ) clearInterval( ticker )
      } )
  }, tickMs )

  rl.on( 'close', () => { inputEnded = true } )

  if ( options.server ) {
    gggWebSocketServer( { 
      url: options.server, 
      machineGenerator, 
      onInput(text) {
        console.log( "onInput", text )
      }, 
      onOutput(text) {
        console.log( "onOutput", text )
      },
      onMessage(text) {
        console.log( "onMessage", text )
      },
    } )
  }
}



// Function to concatenate streams
function concatenateStreams(streams: ReadStream[]): Readable {
  // Using Readable.from to create a single readable stream from multiple sources
  const concatenatedStream = Readable.from((async function* () {
      for (const stream of streams) {
          yield* stream;
      }
  })());

  return concatenatedStream
}
