type FloatT = number
type IntT = number
type BufferIndexT = number

import { floor, mod, max, min, fract, toVector } from "../common/math"
import { isArray, isUndefined } from "../common/util"
import Matrix from "../ggg/Matrix"
import { VecArg } from "../ggg/Language"
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
    case Edge.Mirror:
      const mirrored = floor(val / size) % 2 === 0
      axis.index0 = mirrored ? mod(axis.index0, size) : size - 1 - mod(axis.index0, size)
      break
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
      case Edge.Mirror:
        const mirrored = floor((val + 1) / size) % 2 === 0
        axis.index1 = mirrored ? mod(axis.index1, size) : size - 1 - mod(axis.index1, size)
        break
    }
  }

  return axis
}
