type FloatT = number
type IntT = number
type BufferIndexT = number

import { floor, ceil, mod, max, min, fract, toVector } from "../common/math"
import { isArray, isUndefined } from "../common/util"
import Matrix from "../ggg/Matrix"
import { VecArg } from "../ggg/Language"
import { DimIterate } from "../ggg/Dim"
import { Filter, Edge, Coord } from "./GXLanguage"


interface ResolvedAxis {
  index0: IntT
  index1: IntT
  fraction: FloatT
}


export interface SampleOptions {
  dimension?: IntT
  filter?: Filter | string
  edge?: Edge | string
  coord?: Coord | string
}

export default function Sample( buffer:Matrix, position:VecArg = 0, options:SampleOptions = {}, value?:VecArg  ):number[] | number {
  const { dim } = buffer
  const { dimension = 1 } = options
  const pos = toVector( position )
  
  let channels = 1
  for ( let d = 0; d < dimension; d++ ) {
    channels *= dim[ d ]
  }

  if ( isUndefined( value ) ) {
    value = new Array( channels )
    value.fill( -1 )
  }

  const length = min( channels, isArray( value ) ? value.length : 1 )
  
  const { filter = Filter.Linear, edge = Edge.Repeat, coord = Coord.Normalized } = options

  function computeAxis( dimIndex:number ) {
    const position = pos[ dimIndex ] || 0
    const { fraction, index0, index1 } = resolveAxis( position, dim[ dimIndex ], filter, edge, coord )

    pos[ dimIndex ] = index0
    const sampA = dimIndex > dimension ? computeAxis( dimIndex - 1 ) : buffer.read( pos, new Array( length ) )
    if ( fraction === 0 || index0 === index1 ) 
      return sampA

    pos[ dimIndex ] = index1
    const sampB = dimIndex > dimension ? computeAxis( dimIndex - 1 ) : buffer.read( pos, new Array( length ) )

    for ( let i = 0; i < length; i++ ) {
      sampA[i] = sampA[i] * ( 1 - fraction ) + sampB[i] * fraction
    }

    return sampA
  }

  const result = computeAxis( pos.length - 1 )
  return isArray( value ) ? result : result[0]
}


// Reduce (minification) operators for SampleReduce's footprint fold. Index order
// is the contract for the E sampler-options slot 3 (mirrored in C++).
export const ReduceList: string[] = [ "mid", "min", "max", "add" ]

// Cap on taps per spatial axis, so a huge footprint stays deterministic + bounded.
const MAX_TAPS = 8

//
// Minification: integrate the source over a footprint box around `position`
// (extent in source texels, per spatial axis) and fold the covered samples with
// a reduce operator -- mid (arithmetic mean), min, max, add (sum). Walks a
// taps-per-axis grid (taps = clamp(ceil(footprint),1,MAX_TAPS)); footprint <= 1
// degrades to a single point sample (== Sample). Sampling each tap reuses Sample
// (so filter/edge/coord still apply).
//
export function SampleReduce( buffer:Matrix, position:number[], footprint:number[], reduce:string, options:SampleOptions = {} ):number[] {
  const { dim } = buffer
  const { dimension = 0 } = options

  let channels = 1
  for ( let d = 0; d < dimension; d++ ) channels *= dim[d]
  const rank = position.length - dimension

  const taps:number[] = []
  for ( let a = 0; a < rank; a++ )
    taps[a] = max( 1, min( MAX_TAPS, ceil( footprint[a] || 1 ) ) )

  const init = reduce === "min" ? Infinity : reduce === "max" ? -Infinity : 0
  const acc = new Array( channels ).fill( init )
  let count = 0

  for ( const combo of DimIterate( taps ) ) {
    const pos = position.slice()
    for ( let a = 0; a < rank; a++ ) {
      const srcSize = dim[ dimension + a ] || 1
      const fpNorm = ( footprint[a] || 0 ) / srcSize           // footprint in normalized coords
      const t = taps[a] > 1 ? ( combo[a] + 0.5 ) / taps[a] - 0.5 : 0
      pos[ dimension + a ] += fpNorm * t
    }
    const s = Sample( buffer, pos, options ) as number[]
    for ( let ch = 0; ch < channels; ch++ ) {
      const v = s[ch]
      if ( reduce === "min" ) acc[ch] = min( acc[ch], v )
      else if ( reduce === "max" ) acc[ch] = max( acc[ch], v )
      else acc[ch] += v                                        // add + mid both sum
    }
    count++
  }

  if ( reduce === "mid" && count > 0 )
    for ( let ch = 0; ch < channels; ch++ ) acc[ch] /= count

  return acc
}

function resolveAxis(val: FloatT, size: BufferIndexT, filter: string = Filter.Linear, edge: string = Edge.Repeat, coord: string = Coord.Normalized ): ResolvedAxis {
  const axis: ResolvedAxis = { index0: 0, index1: 0, fraction: 0 }

  size = max(1, size)

  let norm: FloatT = size
  switch (coord) {
    case Coord.Fence:
      norm = filter === Filter.Linear ? size - 1 : size
      break
    case Coord.Pixel:
      norm = 1
      break
  }

  val *= norm
  axis.index0 = floor(val)

  switch (edge) {
    case Edge.Zero:
      if (axis.index0 < 0 || axis.index0 >= size) {
        axis.index0 = -1
      }
      break
    case Edge.Repeat:
      axis.index0 = mod(axis.index0, size)
      break
    case Edge.Hold:
      axis.index0 = max(0, min(size - 1, axis.index0))
      break
    case Edge.Mirror: {
      const mirrored = floor(val / size) % 2 === 0
      axis.index0 = mirrored ? mod(axis.index0, size) : size - 1 - mod(axis.index0, size)
      break
    }
  }

  if (filter === Filter.Nearest) {
    axis.index1 = axis.index0
    axis.fraction = 0
  } else {
    axis.fraction = fract(val)
    axis.index1 = floor(val + 1)
    switch (edge) {
      case Edge.Zero:
        if (axis.index1 < 0 || axis.index1 >= size) {
          axis.index1 = -1
        }
        break
      case Edge.Repeat:
        axis.index1 = mod(axis.index1, size)
        if ( axis.index1 < 0 ) axis.index1 += size
        break
      case Edge.Hold:
        axis.index1 = max(0, min(size - 1, axis.index1))
        break
      case Edge.Mirror: {
        const mirrored = floor((val + 1) / size) % 2 === 0
        axis.index1 = mirrored ? mod(axis.index1, size) : size - 1 - mod(axis.index1, size)
        break
      }
    }
  }

  return axis
}
