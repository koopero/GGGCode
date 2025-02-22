import { isArray, isString } from "../common/util"
import { gggToken, gggParseOptions, ParseOptions } from "./gggLang"
import { gggLimits } from "./gggLimits"
import ParseLine from "./ParseLine"

export type ParseLinesArg = undefined | string 
export type ParseLinesArgs = gggToken | gggToken[] | ParseLinesArg | ParseLinesArg[]


export default function ParseLines( arg:ParseLinesArgs, options:ParseOptions = {} ) : gggToken[] {
  const lines:gggToken[] = []

  function parseChunk( chunk:ParseLinesArgs ) {
    if ( !chunk ) return

    if ( isArray( chunk ) ) {
      return chunk.map( parseChunk )
    }

    if ( isString( chunk ) ) {
      while( chunk ) {
        const [ line, remain ] = ParseLine( chunk, options )
        lines.push( line )
        chunk = remain
      }
      return
    }

    if ( chunk ) {
      const { command, args } = chunk

      if ( command && args ) {
        lines.push( { command, args } )
      }
      return
    }
  }

  parseChunk( arg )

  return lines
}
