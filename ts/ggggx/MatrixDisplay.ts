import { GGG, Hooks, HookArgs } from "../ggg/Language"
import { MatrixEvents } from "./GXLanguage"
import type { Matrix } from "../ggggx"
import { GXContext } from "./GXContext"

function DisplayHookValue( arg:HookArgs ) {
  const { code, value, machine } = arg

  switch( code ) {
    case GGG.Register: {
      const context = GXContext( { machine } )
      const { MatrixResolve } = context

      const buffer = MatrixResolve( value ) as Matrix
      if ( buffer ) {
        machine.emit( MatrixEvents.Display, { buffer } )
      }
      break
    }
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
