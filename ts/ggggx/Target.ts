import ggggxBuffer from "./ggggxBuffer"
import { GGG, } from "../ggg/gggLang"
import { ggggxEvents } from "./ggggxLang"
import { toInt, isString, isNumber } from "../common/util"
import { ggggxEncodingOptions } from "./ggggxLang"
import ggggxContext from "./ggggxContext"

export function TargetHookCommand( arg, target ) {
  const { code, state, value, machine } = arg
  const { create = false } = target

  state.create = create
  state.index = -1
  state.storage = 0
  state.dim = []
  state.dimIndex = 0
  state.offset = parseInt( state.offset ) || 0
  state.offsetMultiplier = 1
  state.offsetDimension = 0

  switch( code ) {
    case GGG.Register:
      const buffer = machine.getRegisterNumbers( value ) as ggggxBuffer
      if ( buffer ) {
        machine.emit( ggggxEvents.Display, { buffer } ) 
      }
      break
  }
}

export function TargetHookCode( arg ) {

}

export function TargetHookValue( arg ) {
  const { code, state, value, machine } = arg
  const { dim } = state
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
      const { offsetMultiplier = 1 } = state
      state.offset += toInt( value ) * offsetMultiplier
      let buffer = TargetBuffer( arg )
      let bufferDim = buffer && buffer.dim
      if ( bufferDim && state.offsetDimension < bufferDim.length ) {
        state.offsetMultiplier = offsetMultiplier * bufferDim[state.offsetDimension]
      }
      state.offsetDimension++
      break


    case GGG.Size:
      state.length = value
      break

    case GGG.Encoding:
      state.encoding = ggggxEncodingOptions.get( value as string )
      break
  }
}

export function TargetResolveNumbers( arg ) {
  const { code, state, value, machine } = arg
  let { dim, name, index, length, storage, create } = state

  let context = ggggxContext( { machine } )
  let { getRegister, BufferInit } = context

  let lookup = index >= 0 ? index : name
  let buffer:ggggxBuffer|null = lookup && getRegister( lookup )

  if ( !buffer && create ) {
    buffer = BufferInit( lookup, { index, name, dim, storage } )
  }


  let position = state.position
  let encoding
  let size

  state.buffer = buffer


  return { position, buffer, dim, encoding, size }
}

function TargetBuffer( arg ) {
  const { machine, index, name } = arg
  const { state } = arg
  let { buffer } = state
  if ( buffer ) {
    return buffer
  }
  let context = ggggxContext( { machine } )
  let { getRegister, BufferInit } = context

  buffer = getRegister( name ) || getRegister( index )

  return buffer
}