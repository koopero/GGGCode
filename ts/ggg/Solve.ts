import { isArray, isNumber, isObject, isUndefined, isString } from "../common/util"
import { gggRangeAxis, gggRangeAxes, gggReference, gggValueWithEncoding, gggPrimitive } from "./gggLang"
import { floor } from "../common/math"
import ParseData from "./ParseData"
import { Matrix } from "../ggggx"

const isUsable = ( v ) => isNumber( v ) && !isNaN( v )
const isBlank = ( v ) => isUndefined( v ) || v === null || isNaN( v )

export type SolveOptions = {
  MatrixResolve?: ( name:string ) => Matrix
  solveStrings?: boolean
}

type SolveArgument = gggPrimitive | gggPrimitive[]

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
        yield* solve( ( value as gggValueWithEncoding ).value )
      } else if ( "axes" in value ) {
        yield* solveRangeAxes( value as gggRangeAxes, register )
      } else if ( "register" in value ) {
        yield* solveReference( value as gggReference )
      } else {
        const dimension = register ? register.getSize() : 1
        yield* solveRangeAxis( value as gggRangeAxis, dimension, 1 )
      }
    }
  }

  function* solveReference( value:gggReference ):Generator<number> {
    const { register, subscript } = value
    const reg = MatrixResolve && MatrixResolve( register )
    if ( reg ) {
      for ( let index of solve( subscript, reg ) ) {
        if ( isNumber( index ) ) {
          let val = reg.readNumber( index )
          if ( isUsable( val ) ) {
            yield val
          }
        }
      }
    }
  }

  function* solveRangeAxis( value:gggRangeAxis, dimension:number, stride:number ):Generator<number> {
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

  function* solveRangeAxes( value:gggRangeAxes, register?:Matrix ):Generator<number> {
    const { axes } = value
    const dimensions:number[] = register ? register.getDimensions() : []
    const strides:number[] = []
    let stride = 1
    for ( let i = 0; i < axes.length; i++ ) {
      strides.push( stride )
      let dim = (dimensions[ i ] as number) || 1
      stride *= dim
    }

    yield* solveAxis( axes.length - 1 )

    function* solveAxis( index:number, offset = 0 ):Generator<number> {
      const dim = (dimensions[ index ] as number) || 1
      const axis = axes[ index ]
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