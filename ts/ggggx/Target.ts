import Matrix from "../ggg/Matrix"
import { GGG, } from "../ggg/Language"
import { MatrixEvents } from "./GXLanguage"
import { toInt, isString, isNumber } from "../common/util"
import { ggggxEncodingOptions } from "./GXLanguage"
import { GXContext } from "./GXContext"

export function TargetHookCommand( arg, target ) {
  const { code, state, value, machine } = arg
  const { create = false } = target

  state.create = false
  state.index = -1
  state.storage = 0
  state.dim = []
  state.dimIndex = 0
  state.offset = []
  state.offsetIndex = 0

  switch( code ) {
    case GGG.Register: {
      const buffer = machine.getRegisterNumbers( value ) as Matrix
      if ( buffer ) {
        machine.emit( MatrixEvents.Display, { buffer } )
      }
      break
    }
  }
}

export function TargetHookCode( arg ) {
  const { code, state, value, machine } = arg
  switch( code ) {
    case GGG.Size:
      state.dim = []
      state.dimIndex = 0
      break

    case GGG.Offset:
      state.offset = []
      state.offsetIndex = 0
      break
  }
}

export function TargetHookValue( arg ) {
  const { code, state, value, machine } = arg
  const { dim, offset } = state
  switch( code ) {
    case GGG.Size:
      dim[state.dimIndex++] = toInt( value )
      break

    case GGG.Alias:
      if ( isString( value ) ) {
        state.name = value
      }
      break

    case GGG.Storage:
      state.type = value
      break

    case GGG.Register:
      if ( isString( value ) ) {
        state.name = value
      } else if ( isNumber( value ) ) {
        state.index = toInt( value )
      }
      break

    case GGG.Offset:
      offset[state.offsetIndex++] = toInt( value )
      break

    case GGG.Encoding:
      state.encoding = ggggxEncodingOptions.get( value as string )
      break
  }
}

export function TargetResolveNumbers( arg ) {
  const { code, state, value, machine } = arg
  const { dim, offset, name, index, length, storage, create } = state

  const lookup = index >= 0 ? index : name
  const buffer:Matrix|null = machine.getMatrix( lookup ) as Matrix

  if ( !buffer && create ) {
    // buffer = MatrixInit( lookup, { index, name, dim, storage } )
  }


  let encoding
  let size

  state.buffer = buffer
  state.offset = offset
  

  return { offset, buffer, dim, encoding, size }
}

function TargetBuffer( arg ) {
  const { machine, index, name } = arg
  const { state } = arg
  let { buffer } = state
  if ( buffer ) {
    return buffer
  }
  const context = GXContext( { machine } )
  const { MatrixResolve, MatrixInit } = context

  buffer = MatrixResolve( name ) || MatrixResolve( index )

  return buffer
}