import Matrix from "../ggg/Matrix"
import Sample from "./Sample"
import { OperatorApply } from "./Operators"
import { DimIterate } from "../ggg/Dim"
import { isString } from "../common/util"
import { Filter, Edge, Coord } from "./GXLanguage"

// Sampler option vocabularies (index order); each option accepts an index or a name.
const FilterList: string[] = [ Filter.Linear, Filter.Nearest ]
const EdgeList: string[]   = [ Edge.Hold, Edge.Repeat, Edge.Mirror, Edge.Zero ]
const CoordList: string[]  = [ Coord.Normalized, Coord.Pixel, Coord.Fence ]

function resolveOption( value: string | number | undefined, list: string[] ): string | undefined {
  if ( value === undefined ) return undefined
  if ( typeof value === "number" ) return list[ value ]
  return value
}

//
// MatrixBlit: copy from a source matrix into a destination through a spatial
// transform, by INVERSE mapping -- iterate destination cells, map each to a
// source coordinate, sample the source there, and combine into the destination.
// Inverse mapping is hole-free. Sampling (interpolation, edge/coord modes,
// channels) is delegated to Sample (./Sample.ts).
//
// The transform is affine, selected by `mode`, which says how the flat `matrix`
// coefficients fill the internal (rank+1)x(rank+1) homogeneous matrix. The rank
// is the destination's spatial rank ( dim.length - dimension ); `dimension` is
// the count of leading channel dims (0 = single-channel, all axes spatial).
//
// Non-affine / arbitrary warp is a separate (future) command; the homogeneous
// form here leaves room for a projective mode later.
//

export const BlitModes = [ "identity", "affine", "scale+translate" ] as const
export type BlitMode = typeof BlitModes[number]

export function resolveMode( mode: string | number | undefined ): BlitMode {
  if ( typeof mode === "number" ) return BlitModes[ mode ] ?? "identity"
  if ( isString( mode ) ) return mode as BlitMode
  return "identity"
}

export interface BlitOptions {
  dimension?: number              // leading channel-dim count (default 0)
  mode?: BlitMode | string | number
  matrix?: number[]               // transform coefficients (per mode)
  offset?: number[]               // dest region offset (spatial)
  size?: number[]                 // dest region size (spatial)
  operator?: string | number      // combine sampled value into dest cell (Q)
  filter?: string | number
  edge?: string | number
  coord?: string | number
}

// Row-major (rank+1) x (rank+1) identity.
function identity( n: number ): number[][] {
  const H: number[][] = []
  for ( let r = 0; r < n; r++ ) {
    H[r] = new Array( n ).fill( 0 )
    H[r][r] = 1
  }
  return H
}

// Build the homogeneous transform from the mode + flat coefficients.
export function buildTransform( mode: BlitMode, M: number[], rank: number ): number[][] {
  const H = identity( rank + 1 )
  if ( mode === "identity" || !M.length ) return H

  if ( mode === "affine" ) {
    // M = rank rows x (rank+1) cols, row-major (linear part + translation).
    for ( let r = 0; r < rank; r++ )
      for ( let c = 0; c < rank + 1; c++ )
        H[r][c] = M[ r * ( rank + 1 ) + c ] ?? H[r][c]
    return H
  }

  if ( mode === "scale+translate" ) {
    // M = [ scale_0..scale_{rank-1}, translate_0..translate_{rank-1} ].
    for ( let i = 0; i < rank; i++ ) {
      H[i][i]    = M[i] ?? 1
      H[i][rank] = M[ rank + i ] ?? 0
    }
    return H
  }

  return H
}

// Apply the homogeneous transform to a normalized coordinate (with perspective
// divide; affine modes leave w == 1).
export function applyHomogeneous( H: number[][], c: number[], rank: number ): number[] {
  let w = H[rank][rank]
  for ( let k = 0; k < rank; k++ ) w += H[rank][k] * c[k]
  const out: number[] = new Array( rank )
  for ( let r = 0; r < rank; r++ ) {
    let v = H[r][rank]
    for ( let k = 0; k < rank; k++ ) v += H[r][k] * c[k]
    out[r] = v / ( w || 1 )
  }
  return out
}

export function Blit( dest: Matrix, source: Matrix, options: BlitOptions = {} ): void {
  const dimension = options.dimension ?? 0
  const mode = resolveMode( options.mode )
  const M = options.matrix ?? []
  const operator = options.operator ?? "set"
  const sampleOpts = {
    dimension,
    filter: resolveOption( options.filter, FilterList ),
    edge: resolveOption( options.edge, EdgeList ),
    coord: resolveOption( options.coord, CoordList ),
  }

  const rank = dest.dim.length - dimension
  const destSpatial = dest.dim.slice( dimension )
  const H = buildTransform( mode, M, rank )

  const size = options.size && options.size.length ? options.size : destSpatial
  const offset = options.offset ?? []

  const channelPrefix = new Array( dimension ).fill( 0 )

  for ( const cell of DimIterate( size ) ) {
    // Destination spatial coordinate (region offset applied).
    const destCoord = cell.map( ( v, a ) => v + ( offset[a] || 0 ) )
    // Normalized [0,1] destination coordinate.
    const c = destCoord.map( ( v, a ) => destSpatial[a] ? v / destSpatial[a] : 0 )
    // Inverse-map to a normalized source coordinate.
    const src = applyHomogeneous( H, c, rank )

    const sampled = Sample( source, channelPrefix.concat( src ), sampleOpts ) as number[]

    const destPos = channelPrefix.concat( destCoord )
    for ( let ch = 0; ch < sampled.length; ch++ ) {
      if ( dimension > 0 ) destPos[0] = ch   // (single leading channel axis)
      const current = dest.read( destPos, 0 ) as number
      dest.write( OperatorApply( operator, current, sampled[ch] ), destPos )
    }
  }
}

export default Blit
