import { gggCasedString, gggToken } from "./gggLang"
import gggParseData from "./gggParseData"

export const regTokenStart = /^(\s*)([a-z])/i
export const regNumberStart = /^[0-9+-]/

export default function gggParseArgument( str:string, keepEncoding:boolean = false, col:number = 1 ) : [ gggToken | null, string ] {
  if ( !str )  return [ null, "" ]

  const match = regTokenStart.exec( str )

  if ( !match ) return [ null, "" ]

  const [ , preamble ] = match
  let [ , , code ] = match
  code = gggCasedString( code )

  let len = code.length
  str = str.substring( preamble.length + len )
  col += preamble.length

  const [ data, remain ] = gggParseData( str, keepEncoding )
  len += str.length - remain.length

  const token : gggToken = {
    col,
    code,
    len,
    data,
  }

  return [ token, remain ]
}