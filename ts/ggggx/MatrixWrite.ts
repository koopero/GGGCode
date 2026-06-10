import { isArray, isNumber, isString, isUndefined } from "../common/util"
import { GGG, GGGFail, Hooks, HookArgs, VecArg } from "../ggg/Language"
import { Matrix } from "../ggggx"
import Operators, { OperatorApply, Ops } from "./Operators"
import { TargetHookCode, TargetHookCommand, TargetHookValue, TargetResolveNumbers } from "./Target"
import { DimNext, DimOffset } from "../ggg/Dim"

function MatrixWriteHookCommand( arg:HookArgs ) {
  const { state } = arg
  TargetHookCommand( arg, { create: true } )
  // Command state persists across invocations, so every transient of a write
  // must start clean -- otherwise a later write inherits a previous command's
  // operator (a stale Q), size, or partial coordinate. Q/size args, processed
  // after this hook, override the defaults.
  state.operator = Ops.set
  state.repeat = false
  state.size = undefined
  state.coord = null
  state.data = []
  state.writingData = false
}

function MatrixWriteHookCode( arg:HookArgs ) {
  TargetHookCode( arg )

  switch( arg.code ) {
    // V is the values slot.
    case GGG.Value: {
      TargetResolveNumbers( arg )
      const { state } = arg
      state.coord = null
      state.writingData = true
      state.size = SizeDefault( state.size, state.buffer.dim, state.offset )

      state.data = []
      break
    }
  }
}

function MatrixWriteHookValue( arg:HookArgs ) {
  TargetHookValue( arg )
  const { code, state, value, machine } = arg
  switch( code ) {
    case GGG.Operator:
      state.operator = Operators.get( value ) || Ops.set
      break

    case GGG.Repeat:
      state.repeat = !!value
      break

    case GGG.Value: {
      const { buffer, offset, size, operator, repeat } = state
      let { coord } = state

      if ( isString( value ) ) 
        break

      if ( !buffer )
        break

      if ( repeat ) {
        state.data.push( value as number )
        break
      }

      coord = DimNext( coord, size as number[], offset ) || []
      state.coord = coord
      const matrixIndex = DimOffset( buffer.dim, coord )

      if ( matrixIndex >= 0 ) {
        const currentValue = buffer.read( matrixIndex ) as number
        const newValue = OperatorApply( operator, currentValue, value )
        buffer.write( newValue, matrixIndex )
      }
    }
      break
  }
}

function MatrixWriteHookEndArg( arg:HookArgs ) {
  const { code, state, value, machine } = arg
  const { repeat } = state
  switch ( code ) {
    case GGG.Value:
      if ( repeat ) {
        const { data, operator, buffer, offset, dim } = state
        MatrixWrite( buffer, { data, operator, offset, size: dim, fill: true } )
      }
      break
  }
}

function MatrixWriteHookEnd( arg:HookArgs ) {
  const { machine, state } = arg
  const { buffer } = state

  if ( buffer ) {
    machine.outputOk()
  } else {
    machine.outputFail( GGGFail.BufferNotFound )
  }
}

export const MatrixWriteHooks = {
  [Hooks.Command]: MatrixWriteHookCommand,
  [Hooks.Code]: MatrixWriteHookCode,
  [Hooks.Value]: MatrixWriteHookValue,
  [Hooks.EndArg]: MatrixWriteHookEndArg,
  [Hooks.End]: MatrixWriteHookEnd,
} 

export type MatrixWriteOptions = {
  offset?: VecArg,
  size?: VecArg,
  operator?: number | string,
  data?: number | number[],
  fill?: boolean
}

export type MatrixWriteArg = number | number[] | MatrixWriteOptions

export type MatrixWriteResult = {
  matrix: Matrix,
  offset: number[] | null,
}

function SizeDefault( size:number[] | null, defaultSize:number[], offset:number[] ) : number[] {
  const sized = []
  for ( let i = 0; i < defaultSize.length; i ++ ) {
    const o = offset[i] || 0
    const s = size?.[i] || Math.max( 0, defaultSize[i] - o )
    sized[i] = s
  }
  return sized
}

export function MatrixWrite( matrix?:Matrix, options:MatrixWriteArg = {} ) : MatrixWriteResult {
  if ( isNumber( options ) || isArray( options ) ) {
    options = { data: options as number | number[] }
  }

  const { operator = Ops.set, fill = false } = options
  let { offset = 0, size, data } = options

  if ( isUndefined( data ) ) {
    data = []
  } else if ( isNumber( data ) ) {
    data = [ data ]
  }

  if ( isNumber( size ) ) {
    size = [ size ]
  }
  
  if ( !matrix ) {
    if ( !size ) {
      size = [ data.length ]
    }
    matrix = new Matrix( { dim: size } )
  } 

  if ( isNumber( offset ) ) {
    offset = [ offset ]
  }

  size = SizeDefault( size, matrix.dim, offset )

  let dataIndex = 0
  let coord: number[] | null = DimNext( null, size as number[], offset ) || []

  let count = 1000000
  while ( coord ) {
    const value = data[dataIndex]
    const matrixIndex = DimOffset( matrix.dim, coord )

    if ( matrixIndex >= 0 ) {
      const currentValue = matrix.read( matrixIndex ) as number
      const newValue = OperatorApply( operator, currentValue, value )
      matrix.write( newValue, matrixIndex )
    }

    dataIndex ++
    if ( dataIndex >= data.length ) {
      if ( fill ) {
        dataIndex = 0
      } else {
        break
      }
    }

    coord = DimNext( coord, size as number[], offset )

    if ( count -- <= 0 ) {
      console.warn( "MatrixWrite: Too many iterations, breaking loop to prevent infinite loop", { coord, size, offset } )
      break
    }
  }

  return { matrix: matrix as Matrix, offset: coord }
}


