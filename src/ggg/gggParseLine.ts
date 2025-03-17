import { FormatPrimitive } from "./Format"
import { GGG, gggToken } from "./gggLang"
import { gggLimits } from "./gggLimits"
import gggParseArgument from "./gggParseArgument"

function formatCommand( token:gggToken ) {
  const {
    code,
    data,
  } = token

  const value = data[0]
  const valueStr = FormatPrimitive( value )

  return `${code}${valueStr}`
}

export default function gggParseLine( str:string, keepEncoding:boolean = false ) : [ gggToken, string ] {
  const args = []
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
    comment = str.substring(commentIndex)
    str = str.substring(0,commentIndex)
  }

  let col = 1

  while ( str ) {
    const [ token, tokenRemain ] = gggParseArgument( str, keepEncoding, col )
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

  const line:gggToken = {
    command,
    args,
    comment
  }

  return [ line, remain ]
}

