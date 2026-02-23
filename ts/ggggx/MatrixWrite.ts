import { GGG, Hooks, HookArgs } from "../ggg/Language"
import { TargetHookCode, TargetHookCommand, TargetHookValue, TargetResolveNumbers } from "./Target"

function WriteBufferHookCommand( arg:HookArgs ) {
  TargetHookCommand( arg, { create: true } )
}

function WriteBufferHookValue( arg:HookArgs ) {
  TargetHookValue( arg )
  const { code, state, value, machine } = arg


  switch( code ) {
    case GGG.Data: {
      TargetResolveNumbers( arg )

      const { offset = 0, coord, buffer } = state
      if ( buffer ) {
        buffer.write( value, offset )
        state.offset = offset + 1
      }
    }
    break
  }
}

function WriteBufferHookEndArg( arg:HookArgs ) {
}


export const WriteBufferHooks = {
  [Hooks.Command]: WriteBufferHookCommand,
  [Hooks.Code]: TargetHookCode,
  [Hooks.Value]: WriteBufferHookValue,
  [Hooks.EndArg]: WriteBufferHookEndArg,
} 
