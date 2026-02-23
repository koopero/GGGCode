import { isArray, isString } from "../common/util"
import { Token, ParseOptions } from "./Language"
import { gggLimits } from "./gggLimits"
import ParseLine from "./ParseLine"

export type ParseLinesArg = undefined | string 
export type ParseLinesArgs = Token | Token[] | ParseLinesArg | ParseLinesArg[]


export default function ParseLines( arg:ParseLinesArgs, options:ParseOptions = {} ) : Token[] {
  const lines:Token[] = []
  let row = 1

  function parseChunk( chunk:ParseLinesArgs ) {
    if ( !chunk ) return

    if ( isArray( chunk ) ) {
      chunk.map( parseChunk )
      return 
    }

    if ( isString( chunk ) ) {
      while( chunk ) {
        const [ line, remain ] = ParseLine( chunk, options )
        line.row = row++
        lines.push( line )
        chunk = remain
      }
      return
    }

    if ( chunk ) {
      const { command, args } = chunk

      if ( command && args ) {
        lines.push( { command, args, row: row++ } )
      }
      return
    }
  }

  parseChunk( arg )

  return lines
}
