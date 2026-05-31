
import { GGG, HookArgs, Hooks } from "../ggg/Language"
import { GXCommandNumbers, GXNamespaceArg } from "./GXLanguage"

export function MatrixListForNamespace( namespace?: GXNamespaceArg ) {
  if ( "string" === typeof namespace ) {
    namespace = { code: namespace }
  }
  namespace = namespace || { code: "" }

  const { code = "" } = namespace

  const { MatrixListResponse } = namespace.index || GXCommandNumbers

  function commandName( command: number ) {
    return code+command
  }

  function MatrixListHookEnd( arg: HookArgs ) {
    const { machine, state } = arg
    machine.outputOk()
  }

  const MatrixListHooks = {
    [Hooks.End]: MatrixListHookEnd,
  }

  return { MatrixListHooks }
}


export const { MatrixListHooks } = MatrixListForNamespace()