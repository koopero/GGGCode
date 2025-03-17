import { isArray, isString } from "../common/util"
import { gggToken, gggParseOptions } from "./gggLang"
import { gggLimits } from "./gggLimits"
import gggParseLine from "./gggParseLine"

export type gggParseLinesArg = undefined | string 
export type gggParseLinesArgs = gggToken | gggToken[] | gggParseLinesArg | gggParseLinesArg[]


export default function gggParseLines( arg:gggParseLinesArgs, keepEncoding:boolean = false ) : gggToken[] {
  const lines:gggToken[] = []

  function parseChunk( chunk:gggParseLinesArgs ) {
    if ( !chunk ) return

    if ( isArray( chunk ) ) {
      return chunk.map( parseChunk )
    }

    if ( isString( chunk ) ) {
      while( chunk ) {
        const [ line, remain ] = gggParseLine( chunk, keepEncoding )
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
