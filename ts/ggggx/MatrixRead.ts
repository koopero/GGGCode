import { GGG, HookArgs, Hooks, Token } from "../ggg/Language"
import { TargetHookCommand, TargetHookValue, TargetResolveNumbers } from "./Target"
import { GXCode, GXCommandNumbers, GXFails, GXNamespace, GXNamespaceArg } from "./GXLanguage"
import { RegionsAdd } from "./Regions"
import { DimOffset, DimSize } from "../ggg/Dim"
import { Matrix } from "../ggggx"
import { ceil, min } from "../common/math"
import { Ops } from "./Operators"

type MatrixReadCodeOptions = {
  lines?: Token[],
  header?: boolean,
  encoding?: string,
  region?: number[],
  regions?: number[][],
  chunk?: number,
}
  
export function MatrixReadForNamespace( namespace?: GXNamespaceArg ) {
  if ( 'string' === typeof namespace ) {
    namespace = { code: namespace }
  }
  namespace = namespace || GXNamespace

  const { MatrixInit, MatrixWrite } = namespace.index || GXCommandNumbers

  function commandName( command: number ) {
    return (namespace.code || GXCode)+command
  }

  function *MatrixReadCode( matrix:Matrix, options: MatrixReadCodeOptions = {} ) : Generator<Token> {
    let { 
      lines = [],
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
              { code: GGG.Operator, data: Ops.set },
              { code: GGG.Offset, data: [ chunkStart ] },
              { 
                code: GGG.Data, 
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
        yield* MatrixReadCode( matrix, { lines, header: false, encoding, region, chunk } )
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
    let { buffer, offset, encoding, size } = TargetResolveNumbers( arg )

    if ( !buffer )
      return machine.fail( { comment: GXFails.BufferNotFound } )

    if ( !encoding )
      return machine.fail( { comment: GXFails.BufferNotFound } )

    const { index, dim, size:bufferSize } = buffer
    offset = DimOffset( dim, offset )
    let { length } = state
    length = length < 0 ? dim[3] : length
    length = min( length, bufferSize - offset )
    const data = buffer.read( [ 0,0,0,offset ], new Array( length ) )
    const tokens = [
      { code: GGG.Register, data: [ index ] },
      { code: GGG.Offset, data: [ offset ] },
      { code: GGG.Data, encoding: encoding.name, data },
    ]
    machine.output( { code: "G-1", tokens } )
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