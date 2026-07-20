import { isArray, isNumber, isObject, isUndefined, isString } from "../common/util"
import { RangeAxis, RangeAxes, Reference, ValueWithEncoding, Primitive } from "./Language"
import { floor } from "../common/math"
import ParseData from "./ParseData"
import { Matrix } from "../ggggx"

const isUsable = ( v ) => isNumber( v ) && !isNaN( v )
const isBlank = ( v ) => isUndefined( v ) || v === null || isNaN( v )

// A blank end has no extent of its own, so what it means depends on whether a
// register is in scope. WITH a register the range runs to that register's
// dimension ($q[1:] / $q[1>] sweep to the end of q). WITHOUT one there is no
// dimension to run to, so the axis is pinned to its start and yields exactly one
// value -- which is what keeps register-less forms like V1|2|3 and V2*10 single
// points. Explicit ranges (a:b) carry their own end and are never touched.
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

  // Resolves one axis against whatever dimension is available. An OPEN axis
  // ("1:", "1>") sweeps to openDim -- the size of the register it was written
  // against. Anything else with a blank end has no extent to sweep, so it pins
  // to a single point; that is what keeps register-less V1|2|3 and V2*10 points.
  function* solveOneAxis( axis:RangeAxis, dimension:number, hasDim:boolean, sweepBlank:boolean, stride:number ):Generator<number> {
    // An open axis sweeps only when a real dimension is in scope; register-less
    // "V1:" has nothing to sweep to and stays a point. A lone axis value pins
    // even when a dimension IS available, so $r[1|1] stays one coordinate.
    // sweepBlank is the legacy bare-register span, where a blank end sweeps too.
    const sweep = ( axis.open && hasDim ) || sweepBlank
    const resolved = sweep ? axis : pinBlankEnd( axis )
    yield* solveRangeAxis( resolved, dimension, stride )
  }

  function* solve( value:any, register?:Matrix, openDim?:number ):Generator<number|string> {
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
      // Carry openDim into each item: a subscript arrives here as an array, and
      // an open axis inside it resolves against the register's dimension.
      for ( const item of value ) {
        yield* solve( item, register, openDim )
      }
    } else if ( isObject( value ) ) {
      if ( "value" in value ) {
        yield* solve( ( value as ValueWithEncoding ).value )
      } else if ( "axes" in value ) {
        yield* solveRangeAxes( value as RangeAxes, register, openDim )
      } else if ( "register" in value ) {
        yield* solveReference( value as Reference )
      } else {
        const hasDim = openDim !== undefined || !!register
        const dim = openDim !== undefined ? openDim
          : register ? register.getSize() : 1
        yield* solveOneAxis( value as RangeAxis, dim, hasDim, !!register, 1 )
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
      // Plain subscript ($x[...]): solve into flat indices, then read those
      // values. The register is passed as openDim only -- an open axis sweeps to
      // the register's size, while coordinates stay register-LESS (stride 1 per
      // axis), which is what keeps $r[a|b] a flat coordinate-wise expansion.
      for ( const index of solve( subscript, undefined, reg.getSize() ) ) {
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

    // A blank end runs to the dimension, whether the range was written ":" or
    // ">" -- the two differ only in whether the endpoint itself is included
    // (handled by the count below). Callers with no register pin the end to the
    // start before getting here, so this only fires when a dimension is real.
    if ( isBlank( end ) ) {
      end = inclusive ? dimension - 1 : dimension
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

  function* solveRangeAxes( value:RangeAxes, register?:Matrix, openDim?:number ):Generator<number> {
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
      const stride = strides[ index ]

      const hasDim = openDim !== undefined || !!register
      for ( const val of solveOneAxis( axes[ index ], openDim !== undefined ? openDim : dim, hasDim, !!register, stride ) ) {
        if ( index == 0 ) {
          yield val + offset
        } else {
          yield* solveAxis( index - 1, val + offset )
        }
      }
    }
  }
}