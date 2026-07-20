import { isArray, isNumber, isObject, isUndefined, isString } from "../common/util"
import { RangeAxis, RangeAxes, Reference, ValueWithEncoding, Primitive } from "./Language"
import { floor } from "../common/math"
import ParseData from "./ParseData"
import { Matrix } from "../ggggx"

const isUsable = ( v ) => isNumber( v ) && !isNaN( v )
const isBlank = ( v ) => isUndefined( v ) || v === null || isNaN( v )

// A lone coordinate value (blank end, no range symbol) is an EXACT single point,
// not an open range to the axis end. Pin it to start so it yields exactly one
// value. Explicit ranges (a:b) keep their end and still sweep.
const pinBlankEnd = ( a:RangeAxis ):RangeAxis =>
  isBlank( a.end ) ? { ...a, end: a.start, inclusive: true } : a

export type SolveOptions = {
  MatrixResolve?: ( name:string ) => Matrix
  solveStrings?: boolean
}

type SolveArgument = Primitive | Primitive[]

export function* Solve( arg:SolveArgument, options:SolveOptions = {
  solveStrings: true
} ):Generator<number|string> {
  const { MatrixResolve, solveStrings = true } = options
  yield* solve( arg )

  function* solve( value:any, register?:Matrix ):Generator<number|string> {
    if ( value === true ) {
      yield 1
    } else if ( isString( value ) ) {
      if ( !solveStrings ) {
        yield value
      } else {
        const [ data ] = ParseData( value )
        if ( data ) {
          yield* solve( data )
        }
      }
    } else if ( isNumber( value ) ) {
      yield value
    } else if ( isArray( value ) ) {
      for ( const item of value ) {
        yield* solve( item )
      }
    } else if ( isObject( value ) ) {
      if ( "value" in value ) {
        yield* solve( ( value as ValueWithEncoding ).value )
      } else if ( "axes" in value ) {
        yield* solveRangeAxes( value as RangeAxes, register )
      } else if ( "register" in value ) {
        yield* solveReference( value as Reference )
      } else {
        // Register-less, a lone value (blank end) is a single point, not an open
        // range to dimension 1 -- pin it. With a register, a blank end is a
        // genuine open range to the register's end ($r[1>]), so leave it.
        const dimension = register ? register.getSize() : 1
        const axis = register ? value : pinBlankEnd( value as RangeAxis )
        yield* solveRangeAxis( axis as RangeAxis, dimension, 1 )
      }
    }
  }

  function* solveReference( value:Reference ):Generator<number> {
    const { register, subscript, offset } = value
    const reg = MatrixResolve && MatrixResolve( register )
    if ( reg ) {
      // Bare $name (no subscript) reads the whole register in order.
      if ( !subscript || ( isArray( subscript ) && subscript.length === 0 ) ) {
        const size = reg.getSize()
        for ( let i = 0; i < size; i++ ) {
          const val = reg.readNumber( i )
          if ( isUsable( val ) ) {
            yield val
          }
        }
        return
      }
      if ( offset ) {
        // Offset reference ($x@[...]): resolve the subscript coordinates against
        // the register's dimensions/strides and yield the resulting flat OFFSETS
        // (not the values). A lone coordinate value is an EXACT coordinate (a
        // single point), not an open range to the axis end -- so blank-end axes
        // are pinned to start. Explicit ranges (a:b) still sweep coordinates.
        const pin = pinBlankEnd
        for ( const item of subscript as any[] ) {
          if ( isNumber( item ) ) {
            yield item
          } else if ( item && typeof item === "object" ) {
            if ( "axes" in item ) {
              yield* solveRangeAxes( { axes: ( item.axes as RangeAxis[] ).map( pin ) }, reg )
            } else if ( "value" in item ) {
              if ( isNumber( item.value ) ) yield item.value
            } else {
              yield* solveRangeAxis( pin( item as RangeAxis ), reg.getSize(), 1 )
            }
          }
        }
        return
      }
      // Plain subscript ($x[...]): solve register-less (Solve drops the register
      // recursing into the array) into flat indices, then read those values.
      for ( const index of solve( subscript, reg ) ) {
        if ( isNumber( index ) ) {
          const val = reg.readNumber( index )
          if ( isUsable( val ) ) {
            yield val
          }
        }
      }
    }
  }

  function* solveRangeAxis( value:RangeAxis, dimension:number, stride:number ):Generator<number> {
    let { start, end, count, step, multiplier, inclusive } = value

    start = start || 0
    

    if ( isBlank( multiplier ) ) {
      multiplier = stride
    }

    if ( isBlank( end ) ) {
      if ( inclusive ) {
        end = start
      } else {
        end = dimension
      }
    }

    if ( !step ) {
      if ( count ) {
        step = (end-start) / ( count - ( inclusive ? 1 : 0 ) )
      } else {
        step = 1
      }
    }

    if ( isBlank( count ) ) {
      if ( step ) {
        count = floor( (end-start) / step )
        if ( inclusive ) count++
      } else {
        count = 1
      }
    }

    let val = start
    for ( let i = 0; i < count; i++ ) {
      yield val * multiplier
      val += step
    }
  }

  function* solveRangeAxes( value:RangeAxes, register?:Matrix ):Generator<number> {
    const { axes } = value
    const dimensions:number[] = register ? register.getDimensions() : []
    const strides:number[] = []
    let stride = 1
    for ( let i = 0; i < axes.length; i++ ) {
      strides.push( stride )
      const dim = (dimensions[ i ] as number) || 1
      stride *= dim
    }

    yield* solveAxis( axes.length - 1 )

    function* solveAxis( index:number, offset = 0 ):Generator<number> {
      const dim = (dimensions[ index ] as number) || 1
      const axis = pinBlankEnd( axes[ index ] )
      const stride = strides[ index ]

      for ( const val of solveRangeAxis( axis, dim, stride ) ) {
        if ( index == 0 ) {
          yield val + offset
        } else {
          yield* solveAxis( index - 1, val + offset )
        }
      }
    }
  }
}