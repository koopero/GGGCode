import { GGG, HookArgs, Hooks, Token } from "../ggg/Language"
import { TargetHookCommand, TargetHookValue, TargetResolveNumbers } from "./Target"
import { GXCode, GXCommandNumbers, GXFails, GXNamespace, GXNamespaceArg } from "./GXLanguage"
import { RegionsAdd } from "./Regions"
import { DimOffset, DimSize } from "../ggg/Dim"
import { Matrix } from "../ggggx"
import { ceil, min } from "../common/math"

type MatrixReadCodeOptions = {
  header?: boolean,
  encoding?: string,
  region?: number[],
  regions?: number[][],
  chunk?: number,
}
  
export function MatrixReadForNamespace( namespace?: GXNamespaceArg ) {
  if ( "string" === typeof namespace ) {
    namespace = { code: namespace }
  }
  namespace = namespace || GXNamespace

  const { MatrixInit, MatrixWrite } = namespace.index || GXCommandNumbers

  function commandName( command: number ) {
    return (namespace.code || GXCode)+command
  }

  function *MatrixReadCode( matrix:Matrix, options: MatrixReadCodeOptions = {} ) : Generator<Token> {
    let { 
      header = true,
      encoding = "",
      region = null,
      regions = null,
      chunk = 128,
    }= options
    
    const { name = "", index = -1, dim, storage } = matrix
    encoding = encoding || storage.encoding 

    if ( header ) {
      if ( MatrixInit ) {
        yield { command: commandName( MatrixInit ), args: [
          { code: GGG.Register, data: index },
          { code: GGG.Alias, data: name },
          { code: GGG.Size, data: dim },
          { code: GGG.Storage, data: storage.name },
        ] }
      }

      if ( !regions  && !region ) {
        region = [ 0, DimSize( dim ) ]
      }
    }

    if ( region && region.length ) {
      const [ start, end ] = region
      const size = end - start
      const chunkCount = ceil( size / chunk )
      for ( let chunkIndex = 0; chunkIndex < chunkCount; chunkIndex++ ) {
        const chunkStart = start + chunkIndex * chunk
        const chunkEnd = Math.min( chunkStart + chunk, end )
        const chunkSize = chunkEnd - chunkStart
        const data = matrix.read( chunkStart, new Array( chunkSize ) ) as number[]
        if ( MatrixWrite ) {
          yield {
            command: commandName( MatrixWrite ),
            args: [
              { code: GGG.Register, data: index },
              // No operator emitted: a read replay is always a "set", and an
              // omitted Q defaults to set on write. Keeps the G10 return terse
              // and byte-aligned with the C++ peer (G20 R# P# V...).
              { code: GGG.Offset, data: [ chunkStart ] },
              {
                // V is the canonical values slot; the representation is carried
                // separately in `encoding`. A G10 response is a replayable G20.
                code: GGG.Value,
                data,
                encoding
              },
            ]
          }
        }
      }
    }

    if ( regions && regions.length ) {
      for ( const region of regions ) {
        yield* MatrixReadCode( matrix, { header: false, encoding, region, chunk } )
      }
    } 

  }

  function MatrixReadHookCommand( arg:HookArgs ) {
    const { state } = arg
    TargetHookCommand( arg, {} )
  }

  function MatrixReadHookValue( arg:HookArgs ) {
    const { code, state, value, machine } = arg
    const limits = machine.state.ggggxLimits
    TargetHookValue( arg )
  }

  function MatrixReadHookEnd( arg:HookArgs) {
    const { machine, state } = arg
    const { buffer } = TargetResolveNumbers( arg )

    if ( !buffer )
      return machine.outputOk( 0, GXFails.BufferNotFound )

    // Encoding is a representation concern, defaulted from the buffer's storage
    // (the C++ peer needs none); it never gates locating the buffer.
    const encoding = state.encoding || ( buffer.storage && buffer.storage.encoding )

    // Region defaults mirror the C++ MatrixRead: start at the requested offset
    // (P), span the rest of the buffer unless an explicit count (S) was given.
    const total = DimSize( buffer.dim )
    let start = state.offset?.[0] || 0
    if ( start < 0 || start > total ) start = 0
    let count = state.dim?.[0]
    if ( count === undefined || count === null ) count = total - start
    if ( count > total - start ) count = total - start

    for ( const line of MatrixReadCode( buffer, { header: false, encoding, region: [ start, start + count ] } ) ) {
      machine.output( { ...line, eol: true } )
    }

    machine.outputOk()
  }

  const MatrixReadHooks = {
    [Hooks.Command]: MatrixReadHookCommand,
    [Hooks.Value]: MatrixReadHookValue,
    [Hooks.End]: MatrixReadHookEnd,
  }

  return { MatrixReadCode, MatrixReadHooks }
}

const { MatrixReadCode, MatrixReadHooks } = MatrixReadForNamespace()
export { MatrixReadCode, MatrixReadHooks }