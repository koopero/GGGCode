import { FormatPrimitive } from "./Format"
import { GGG, Token, ParseOptions } from "./Language"
import { gggLimits } from "./gggLimits"
import ParseArg from "./ParseArg"

function formatCommand( token:Token ) {
  const {
    code,
    data,
  } = token

  const value = data[0]
  const valueStr = FormatPrimitive( value )

  return `${code}${valueStr}`
}

export default function ParseLine( str:string, options:ParseOptions = {} ) : [ Token, string ] {
  const { keepComments = true } = options
  const args:Token[] = []
  let command = ""
  let comment = ""
  let remain = ""

  const endIndex = str.indexOf( GGG.End )

  if ( endIndex != -1 ) {
    remain = str.substring(endIndex+1)
    str = str.substring(0,endIndex)
  }

  const commentIndex = str.indexOf( GGG.Comment )
  if ( commentIndex != -1 ) {
    if ( keepComments ) {
      comment = str.substring(commentIndex)
    }
    str = str.substring(0,commentIndex)
  }

  // Raw command source (comments and the trailing newline already stripped),
  // kept verbatim so flow-control frames can re-enqueue a captured body as
  // authoritative source. See Machine.enqueueLines / gggtx procedures.
  const source = str.trim()

  let col = 1

  while ( str ) {
    const [ token, tokenRemain ] = ParseArg( str, options, col )
    if ( token ) {
      args.push( token )
      col += str.length - tokenRemain.length 
      str = tokenRemain
    } else {
      break
    }
  }

  if ( args.length ) {
    const first = args.shift()
    if ( first )
      command = formatCommand( first )
  }

  const line:Token = {
    command,
    args,
    comment,
    source
  }

  return [ line, remain ]
}

