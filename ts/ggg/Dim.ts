import { isArray, isDefined, isNumber, isObject, isRealNumber } from "../common/util"
import { min, max, floor, ceil, toNorm8, toVector } from "../common/math"
import { ggggxDimension, ggggxVecArg, ggggxDimArg } from "./gggLang"




export function DimOffset( dim: ggggxDimension, coord:ggggxVecArg = 0, defaultValue:number = -1 ) {
  coord = toVector( coord )
  let dimIndex = 0
  let mult = 1
  let offset = 0

  function append( arg ) {
    if ( isNaN( offset ) ) return -1
    if ( isNumber( arg ) ) {
      arg = floor( arg )
      const adim = dim[dimIndex] > 0 ? ceil( dim[dimIndex] ) : 1
      if ( dimIndex > 0 && ( arg >= adim || arg < 0 || isNaN( arg ) ) ) {
        offset = NaN
      } else {
        offset += arg * mult
        mult *= adim
      }
      dimIndex++
    } else if ( isArray( arg ) ) {
      arg.map( append )
    }
  }

  append( coord )
  return isNaN( offset ) ? defaultValue : offset
}



export function DimFrom( dim: ggggxDimArg ) : ggggxDimension {
  if ( !dim ) {
    dim = []
  } else if ( isNumber( dim ) ) {
    dim = [ max( 1, ceil(dim) || 0 ) ]
  } else if ( isArray( dim ) ) {
    dim = dim.map( d => max( 1, ceil( d ) || 0 ) )
  }

  while ( dim[dim.length-1] == 1 ) {
    dim.pop()
  }

  return dim as ggggxDimension
}

export function DimPad( dim: ggggxDimension, length:number ) {
  if ( dim.length >= length ) {
    return dim
  }
  const newDim = [ ...dim ]
  while ( newDim.length < length ) {
    newDim.push( 1 )
  }
  return newDim
}

export function DimSize( dim: ggggxDimension ) {
  if ( !dim.length ) return 0
  return dim.reduce( ( a, b ) => a * b, 1 )
}


export function *DimIterate(dim: number[], step: number | number[] = 1): Generator<number[]> {
  // Handle step as either a single number or an array
  if (Array.isArray(step)) {
    step = step.reduce((acc, val) => acc * val, 1) // Multiply elements if array (equivalent to DimSize)
  }

  let coord = Array(dim.length).fill(0) // Initialize coord with zeros

  while (true) {
    yield [...coord] // Yield a copy of coord

    let carry = step
    for (let i = 0; i < dim.length; i++) {
      coord[i] += carry
      if (coord[i] < dim[i]) {
        carry = 0
        break
      } else {
        carry = Math.floor(coord[i] / dim[i])
        coord[i] %= dim[i]
      }
    }

    // If carry is still non-zero, we've iterated through all coordinates
    if (carry) break
  }
}
