import { GGG, Hooks, HookArgs } from "../ggg/Language"
import { isString } from "../common/util"
import Matrix from "../ggg/Matrix"
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

  const { code, state, value } = arg
  // L assigns a name; it never selects. Held separately from the R selector
  // (state.name / state.index) so `G30 R"img" L"icon"` renames one buffer rather
  // than addressing two.
  if ( code === GGG.Alias && isString( value ) ) {
    state.newName = value
  }
}

export function MatrixInitHookEnd( arg:HookArgs ) {
  const { machine, state } = arg

  const ggggx = GXContext( { machine } )
  const { MatrixInit } = ggggx
  const { index, name, newName, dim, storage  } = state || {}
  // Select with R (index or name); with no R, fall back to the name being
  // assigned so a bare `G30 L"img"` still creates/addresses "img".
  const buffer = MatrixInit({ name: name || newName, index }, { dim, storage } )
  buffer.clear( { dim, storage})

  if ( newName && buffer.name !== newName ) {
    machine.getRegisterList( Matrix ).setItemName( buffer, newName )
  }

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

