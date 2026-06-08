import Matrix from "../ggg/Matrix"
import Sample, { SampleReduce, ReduceList } from "./Sample"
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
// (M) coefficients fill the internal (rank+1)x(rank+1) homogeneous matrix. The
// rank is the destination's spatial rank ( dim.length - dimension ); `dimension`
// is the count of leading channel dims (0 = single-channel, all axes spatial).
//
// Modes (M reused per mode):
//   box (default) -- M = a source rectangle, min,max pairs per axis in SOURCE
//                    PIXEL coords; the rect is stretched to fill the dest.
//                    Omitted pair/value defaults to the full source [0,dim], so
//                    the default box is an identity copy. Subsumes scale+translate.
//   map           -- like box, but M is (axis, min, max) triples -- each names the
//                    axis it sets, so you can remap one axis and leave the rest
//                    identity. Unnamed axes stay full-source.
//   affine        -- M = the general rank x (rank+1) matrix (rotation/shear/...).
//
// (An identity copy is just the default box, so there is no separate identity
// mode.) Non-affine / arbitrary warp is a separate (future) command; the
// homogeneous form here leaves room for a projective mode later.
//

export const BlitModes = [ "box", "affine", "map" ] as const
export type BlitMode = typeof BlitModes[number]

export function resolveMode( mode: string | number | undefined ): BlitMode {
  if ( typeof mode === "number" ) return BlitModes[ mode ] ?? "box"
  if ( isString( mode ) ) return mode as BlitMode
  return "box"
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
  reduce?: string | number        // minification fold (mid/min/max/add); off = point sample
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

// Build the homogeneous transform from the mode + flat M coefficients. `srcDims`
// (source spatial dims) is needed by `box` to normalize the pixel rectangle and
// to default omitted bounds to the full source extent.
export function buildTransform( mode: BlitMode, M: number[], rank: number, srcDims: number[] = [] ): number[][] {
  const H = identity( rank + 1 )

  if ( mode === "affine" ) {
    if ( !M.length ) return H
    // M = rank rows x (rank+1) cols, row-major (linear part + translation).
    for ( let r = 0; r < rank; r++ )
      for ( let c = 0; c < rank + 1; c++ )
        H[r][c] = M[ r * ( rank + 1 ) + c ] ?? H[r][c]
    return H
  }

  if ( mode === "box" ) {
    // M = [ min_0, max_0, min_1, max_1, ... ] in source PIXEL coords. Each axis
    // maps dest-normalized c -> source-normalized ( min + c*(max-min) ) / dim, an
    // axis-aligned scale+translate. Omitted min/max default to [0, dim] (full
    // source), so a bare box is an identity copy.
    for ( let i = 0; i < rank; i++ ) {
      const dim = srcDims[i] || 1
      const lo = M[ 2 * i ] ?? 0
      const hi = M[ 2 * i + 1 ] ?? dim
      H[i][i]    = ( hi - lo ) / dim
      H[i][rank] = lo / dim
    }
    return H
  }

  if ( mode === "map" ) {
    // M = [ axis, min, max, axis, min, max, ... ] -- each triple sets one named
    // axis's source rect (pixel coords), like box but axis-addressed. Axes not
    // named stay identity (full source); incomplete trailing triples are ignored.
    for ( let i = 0; i + 3 <= M.length; i += 3 ) {
      const axis = Math.floor( M[i] )
      if ( axis < 0 || axis >= rank ) continue
      const dim = srcDims[axis] || 1
      const lo = M[ i + 1 ]
      const hi = M[ i + 2 ]
      H[axis][axis] = ( hi - lo ) / dim
      H[axis][rank] = lo / dim
    }
    return H
  }

  // unknown / unset mode -> identity passthrough (the default box covers identity)
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

// Footprint (in source texels, per spatial axis) covered by one destination
// texel, via a numerical Jacobian: step one dest texel along each dest axis and
// measure the resulting source displacement (max over dest-axis directions).
// Drives minification reduction; <= 1 means no aliasing (point sample suffices).
function footprintOf( H: number[][], c: number[], destSpatial: number[], srcSpatial: number[], rank: number ): number[] {
  const src = applyHomogeneous( H, c, rank )
  const fp = new Array( rank ).fill( 0 )
  for ( let a = 0; a < rank; a++ ) {
    const cc = c.slice()
    cc[a] += 1 / ( destSpatial[a] || 1 )
    const src2 = applyHomogeneous( H, cc, rank )
    for ( let b = 0; b < rank; b++ ) {
      const d = Math.abs( src2[b] - src[b] ) * ( srcSpatial[b] || 1 )
      if ( d > fp[b] ) fp[b] = d
    }
  }
  return fp
}

export function Blit( dest: Matrix, source: Matrix, options: BlitOptions = {} ): void {
  const dimension = options.dimension ?? 0
  const mode = resolveMode( options.mode )
  const M = options.matrix ?? []
  const operator = options.operator ?? "set"
  const reduce = resolveOption( options.reduce, ReduceList )
  const sampleOpts = {
    dimension,
    filter: resolveOption( options.filter, FilterList ),
    edge: resolveOption( options.edge, EdgeList ),
    coord: resolveOption( options.coord, CoordList ),
  }

  const rank = dest.dim.length - dimension
  const destSpatial = dest.dim.slice( dimension )
  const srcSpatial = source.dim.slice( dimension )
  const H = buildTransform( mode, M, rank, srcSpatial )

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

    // With a reduce op, integrate the transform-derived footprint (minification);
    // otherwise point/interpolated sample. SampleReduce degrades to a point
    // sample when the footprint is <= 1 texel, so no separate branch is needed.
    const sampled = reduce
      ? SampleReduce( source, channelPrefix.concat( src ), footprintOf( H, c, destSpatial, srcSpatial, rank ), reduce, sampleOpts )
      : Sample( source, channelPrefix.concat( src ), sampleOpts ) as number[]

    const destPos = channelPrefix.concat( destCoord )
    for ( let ch = 0; ch < sampled.length; ch++ ) {
      if ( dimension > 0 ) destPos[0] = ch   // (single leading channel axis)
      const current = dest.read( destPos, 0 ) as number
      dest.write( OperatorApply( operator, current, sampled[ch] ), destPos )
    }
  }
}

export default Blit
