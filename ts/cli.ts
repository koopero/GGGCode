

import * as optimist from "optimist"
import { isArray } from "./common/util"
import Machine from "./ggg/Machine"
import * as readline from "readline"
import { createReadStream, ReadStream  } from "fs"
import { Readable, pipeline } from 'stream'
import Format from "./ggg/Format"
import gggWebSocketServer from "./websocket/gggWebSocketServer"

export function addStandardOptions( parser ) {
  return parser.options({
    "help": {
      alias: "h",
      describe: "Show help",
      type: "boolean"
    },
    "version": {
      alias: "v",
      describe: "Show version",
      type: "boolean"
    },
    "client": {
      alias: "c",
      describe: "Connect to WebSocket server",
      type: "string",
    },
    "server": {
      alias: "s",
      describe: "Start WebSocket server",
      type: "string",
    },
    "extension": {
      alias: "x",
      describe: "Load builtin extension",
      type: "string",
    },
    "module": {
      alias: "m",
      describe: "Load commands from module",
    },
    "echo": {
      alias: "e",
      describe: "Echo input",
    },
    "interpreter": {
      alias: "i",
      describe: "Start interactive interpreter",
    },
    "quiet": {
      alias: "q",
      describe: "Don't print output",
    },
    "ok": {
      alias: "k",
      describe: "Print 'OK' commands",
      type: "boolean",
    },
    "image": {
      alias: "i",
      describe: "Image file output",
      type: "string",
    }
  })
}


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
  let parser = optimist
  parser = parser.usage(`Usage: $0 [options] [files]`)
  parser = addStandardOptions( parser )
  const options = parser.argv

  if ( options.help ) {
    parser.showHelp()
    process.exit(0)
  }

  if ( options.version ) {
    console.log( "0.0.1" )
    process.exit(0)
  }

  let commands = {}

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

  function output( line ) {
    if ( options.quiet )
      return
    console.log( line )
  }

  const machine = machineGenerator()

  machine.on( "output", line => {
    line = Format( line )
    process.stdout.write( line )
  })

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


