import { GGG, Hooks, HookArgs } from "../ggg/Language"
import { TargetHookCode, TargetHookCommand, TargetHookValue } from "./Target"
import { GXContext } from "./GXContext"
import { toKeyDescription } from "../ggg/NamedList"
import { describeMatrix } from "../ggg/Matrix"



export function MatrixInitHookCommand( arg:HookArgs ) {
  const { state } = arg
  TargetHookCommand( arg, { create: true } )
}

export function MatrixInitHookCode( arg:HookArgs ) {
  const { code, state } = arg
  TargetHookCode( arg )
}

export function MatrixInitHookValue( arg:HookArgs ) {
  TargetHookValue( arg )

  const { code, state, value, machine } = arg
  switch ( code ) {
    case GGG.Alias: {
      const { buffer } = state
      if ( buffer ) {
        buffer.name = value
      }
      break
    }
  }
}

export function MatrixInitHookEnd( arg:HookArgs ) {
  const { machine, state } = arg

  const ggggx = GXContext( { machine } )
  const { MatrixInit } = ggggx
  const { index, name, dim, storage  } = state || {}
  const key = name || index
  const buffer = MatrixInit({ name, index }, { dim, storage } )
  buffer.clear( { dim, storage})

  if ( !buffer ) {
    // buffer creation failed
  }

  machine.outputOk()
}

export const MatrixInitHooks = {
  [Hooks.Command]: MatrixInitHookCommand,
  [Hooks.Code]: MatrixInitHookCode,
  [Hooks.Value]: MatrixInitHookValue,
  [Hooks.End]: MatrixInitHookEnd,
}

