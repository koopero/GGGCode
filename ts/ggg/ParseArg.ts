import { CasedString, Token, ParseOptions } from "./Language"
import ParseData from "./ParseData"

export const regTokenStart = /^(\s*)([a-z])/i
export const regNumberStart = /^[0-9+-]/

export default function ParseArg( str:string, options:ParseOptions = {}, col:number = 1 ) : [ Token | null, string ] {
  if ( !str )  return [ null, "" ]

  const match = regTokenStart.exec( str )

  if ( !match ) return [ null, "" ]

  const [ , preamble ] = match
  let [ , , code ] = match
  code = CasedString( code )

  let len = code.length
  str = str.substring( preamble.length + len )
  col += preamble.length

  const [ data, remain ] = ParseData( str, options )
  len += str.length - remain.length

  const token : Token = {
    col,
    code,
    len,
    data,
  }

  return [ token, remain ]
}