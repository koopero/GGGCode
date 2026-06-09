type FloatT = number
type IntT = number

import { floor, ceil, mod, max, min, fract, toVector } from "../common/math"
import Matrix from "../ggg/Matrix"
import { VecArg } from "../ggg/Language"
import { Filter, Edge } from "./GXLanguage"


interface ResolvedAxis {
  index0: IntT
  index1: IntT
  fraction: FloatT
}

// Per-axis sampler vocabularies (index order is the contract, mirrored in C++).
//   filter (`I` arg) -- how a sample point reads texels: linear (lerp the two
//                       neighbours) or nearest (point).
//   fold   (`F` arg) -- how to reduce the footprint when MINIFYING: none (no
//                       reduction -- just sample the centre via the filter, which
//                       aliases), mean (box average), min/max (extrema), add (sum).
//                       Independent of the filter, so `linear` can minify without
//                       a forced mean, and `mean` is explicit.
export const FilterList: string[] = [ Filter.Linear, Filter.Nearest ]
export const FoldList: string[] = [ "none", "mean", "min", "max", "add" ]

// Edge order for the `E` arg. Index 0 = loop (wrap) -- the default; internal
// string is still Edge.Repeat.
export const EdgeList: string[] = [ Edge.Repeat, Edge.Hold, Edge.Mirror, Edge.Zero ]

// Cap on taps per spatial axis, so a huge footprint stays deterministic + bounded.
const MAX_TAPS = 8
const EPS = 1e-6

export interface SampleOptions {
  dimension?: IntT
  filter?: string[]     // per spatial axis (continue-last); default linear
  fold?: string[]       // per spatial axis (continue-last); default none
  edges?: string[]      // per spatial axis (continue-last); default loop (=repeat)
  footprint?: number[]  // per spatial axis, source-texel extent; default 0 (point)
}

// Continue-last pick from a per-axis list (a single value broadcasts to all axes).
function pick( list: string[] | undefined, a: IntT, dflt: string ): string {
  if ( !list || !list.length ) return dflt
  return list[ min( a, list.length - 1 ) ]
}

//
// N-D separable sampler: at each spatial axis, either sample a point via the
// `filter` (linear lerp / nearest), or -- when MINIFYING and a `fold` is set --
// reduce the footprint by point-sampling its taps and folding them (mean / min /
// max / add). Filter and fold are independent: `none` fold means a minifying
// `linear` just lerps the centre (aliases), and `mean` is an explicit fold. Edge
// handling is per axis (always normalized coords). The leading `dimension` axes
// are channels, read as one contiguous block. The sampling primitive under
// MatrixBlit (G40).
//
export default function Sample( buffer:Matrix, position:VecArg = 0, options:SampleOptions = {} ):number[] {
  const { dim } = buffer
  const { dimension = 0, filter, fold, edges, footprint } = options
  const pos = toVector( position ).slice()

  let channels = 1
  for ( let d = 0; d < dimension; d++ ) channels *= dim[d]
  if ( channels < 1 ) channels = 1

  function read():number[] {
    return buffer.read( pos, new Array( channels ) ) as number[]
  }

  function combineAxis( dimIndex:IntT ):number[] {
    const a = dimIndex - dimension
    const filt = pick( filter, a, Filter.Linear )
    const fld = pick( fold, a, "none" )
    const edge = pick( edges, a, Edge.Repeat )
    const fp = footprint ? ( footprint[a] || 0 ) : 0
    const size = max( 1, dim[dimIndex] )
    const center = pos[dimIndex] || 0

    const inner = ():number[] => dimIndex > dimension ? combineAxis( dimIndex - 1 ) : read()

    // MINIFY fold: point-sample the footprint's taps and reduce them (the filter
    // governs point sampling, not the fold, so a fold integrates raw texels).
    if ( fld !== "none" && fp > 1 + EPS ) {
      const taps = max( 1, min( MAX_TAPS, ceil( fp - EPS ) ) )
      const fpNorm = fp / size
      const init = fld === "min" ? Infinity : fld === "max" ? -Infinity : 0
      const acc = new Array( channels ).fill( init )
      for ( let t = 0; t < taps; t++ ) {
        const offset = taps > 1 ? ( t + 0.5 ) / taps - 0.5 : 0
        pos[dimIndex] = resolveAxis( center + fpNorm * offset, size, Filter.Nearest, edge ).index0
        const s = inner()
        for ( let i = 0; i < channels; i++ ) {
          if ( fld === "min" ) acc[i] = min( acc[i], s[i] )
          else if ( fld === "max" ) acc[i] = max( acc[i], s[i] )
          else acc[i] += s[i]
        }
      }
      if ( fld === "mean" ) for ( let i = 0; i < channels; i++ ) acc[i] /= taps
      return acc
    }

    // Otherwise sample a single point via the filter.
    if ( filt === Filter.Nearest ) {
      pos[dimIndex] = resolveAxis( center, size, Filter.Nearest, edge ).index0
      return inner()
    }
    const { index0, index1, fraction } = resolveAxis( center, size, Filter.Linear, edge )
    pos[dimIndex] = index0
    const sampA = inner()
    if ( fraction === 0 || index0 === index1 ) return sampA
    pos[dimIndex] = index1
    const sampB = inner()
    for ( let i = 0; i < channels; i++ ) sampA[i] = sampA[i] * ( 1 - fraction ) + sampB[i] * fraction
    return sampA
  }

  if ( pos.length === 0 ) return read()
  return combineAxis( pos.length - 1 )
}


// Resolve a normalized axis position to texel index(es). `filter` only chooses 1
// vs 2 taps (nearest vs linear) + the fraction; `edge` clamps/wraps out-of-range.
// Coordinate modes (pixel/fence) were dropped -- the blit is always normalized.
function resolveAxis( val: FloatT, size: IntT, filter: string, edge: string ): ResolvedAxis {
  const axis: ResolvedAxis = { index0: 0, index1: 0, fraction: 0 }

  size = max( 1, size )
  val *= size
  axis.index0 = floor( val )

  switch ( edge ) {
    case Edge.Zero:
      if ( axis.index0 < 0 || axis.index0 >= size ) axis.index0 = -1
      break
    case Edge.Hold:
      axis.index0 = max( 0, min( size - 1, axis.index0 ) )
      break
    case Edge.Mirror: {
      const mirrored = floor( val / size ) % 2 === 0
      axis.index0 = mirrored ? mod( axis.index0, size ) : size - 1 - mod( axis.index0, size )
      break
    }
    default: // Edge.Repeat (loop)
      axis.index0 = mod( axis.index0, size )
  }

  if ( filter === Filter.Nearest ) {
    axis.index1 = axis.index0
    axis.fraction = 0
  } else {
    axis.fraction = fract( val )
    axis.index1 = floor( val + 1 )
    switch ( edge ) {
      case Edge.Zero:
        if ( axis.index1 < 0 || axis.index1 >= size ) axis.index1 = -1
        break
      case Edge.Hold:
        axis.index1 = max( 0, min( size - 1, axis.index1 ) )
        break
      case Edge.Mirror: {
        const mirrored = floor( ( val + 1 ) / size ) % 2 === 0
        axis.index1 = mirrored ? mod( axis.index1, size ) : size - 1 - mod( axis.index1, size )
        break
      }
      default: // Edge.Repeat (loop)
        axis.index1 = mod( axis.index1, size )
        if ( axis.index1 < 0 ) axis.index1 += size
    }
  }

  return axis
}
