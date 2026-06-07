
import { HookArgs, Hooks } from "../ggg/Language"
import Matrix from "../ggg/Matrix"
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
    const { machine } = arg

    machine.output( { code: commandName( MatrixListResponse ), comment: "List buffers", eol: true } )

    // Enumerate the matrix registers G30 created; one comment line each (the
    // D1 / R1 "list as comments" convention). eol marks each as a complete line.
    const registers = machine.getRegisterList( Matrix )
    registers.eachPair( ( buffer, key ) => {
      const matrix = buffer as Matrix
      const dim = matrix.getDimensions()
      const storage = ( matrix.storage && matrix.storage.name ) || ""
      machine.output( { comment: `${key}: [${dim}] ${storage}`, eol: true } )
    } )

    machine.outputOk()
  }

  const MatrixListHooks = {
    [Hooks.End]: MatrixListHookEnd,
  }

  return { MatrixListHooks }
}


export const { MatrixListHooks } = MatrixListForNamespace()
