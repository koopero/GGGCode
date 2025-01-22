import { isNumber, isObject } from "../common/util"
import gggFormat from "../ggg/gggFormat"
import type { gggCommands } from "../ggg/gggLang"
import gggMachine from "../ggg/gggMachine"
import gggdxCommands from "../gggdx/gggdxCommands"

type gggWebSocketServerOptions = {
  url?:string
  machineGenerator:() => gggMachine
  onOutput?:( text:string ) => void
  onMessage?:( text:string ) => void
  onInput?:( text:string ) => void
}

function parseWebsocketUrl( url:string|number ) {
  if ( isNumber( url ) || !isNaN( parseInt( url as string ) ) ) {
    return { port:url as number, host:"localhost" }
  } 
  url = url as string

  const [ host, port ] = url.split( ":" )
  return { host, port }
}

export default function gggWebSocketServer( options:gggWebSocketServerOptions ) {
  const { 
    url,
    machineGenerator,
    onOutput,
    onInput,
    onMessage,
  } = options


  const WebSocket = require( "ws" )
  const { host, port } = parseWebsocketUrl( url )
  if ( port && host ) {
    const server = new WebSocket.Server( { port, host } )
    server.on( "connection", onConnection )
    onMessage && onMessage( `; WebSocket server started ; ${url}` )
  } else {
    onMessage && onMessage( `; Invalid websocket args ; ${port}` )

  }

  function onConnection( ws:any ) {
    const machine = machineGenerator()

    ws.send( "; Connected" )


    machine.on( "output", ( tokens ) => {
      const str = gggFormat( tokens )
      if ( onOutput ) {
        onOutput( str )
      }
      ws.send( str )
    })

    function onMessage( message ) {
      if ( isObject( message ) ) {
        message = message.toString()
      }
      if ( onInput ) {
        onInput( message )
      }
      machine.write( message )
    }

    function onClose() {
      console.log( "closed" )
    }

    ws.on( "message", onMessage )
    ws.on( "close", onClose )
  }
}

