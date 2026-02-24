import { GGG, Hooks, HookArgs } from "../ggg/Language"
import { MatrixEvents } from "./GXLanguage"
import type { Matrix } from "../ggggx"
import { TargetHookCode, TargetHookCommand, TargetHookValue, TargetResolveNumbers } from "./Target"
import { GXContext } from "./GXContext"

function DisplayHookValue( arg:HookArgs ) {
  const { code, value, machine, state } = arg
  const { } = TargetResolveNumbers( arg )
  
  switch( code ) {
    case GGG.Register:
      const context = GXContext( { machine } )
      const { MatrixResolve } = context

      const buffer = MatrixResolve( value ) as Matrix
      if ( buffer ) {
        machine.emit( MatrixEvents.Display, { buffer } ) 
      }
      break
  }
}

function DisplayHookEnd( arg:HookArgs ) {
  const { machine, state } = arg

  machine.outputOk()
}

export const MatrixDisplayHooks = {
  [Hooks.Value]: DisplayHookValue,
  [Hooks.End]: DisplayHookEnd,
}

