import Machine from "../ggg/Machine"
import Matrix from "../ggg/Matrix"
import Format from "../ggg/Format"
import { Commands } from "../ggg/Language"
import { Subsystem, SUBSYSTEMS } from "./cases"

//
// The canonical "golden" output producer. The TypeScript implementation is the
// reference: golden() runs a program through the TS Machine and renders its
// output exactly as the CLI does (ts/cli.ts: each output item through Format()
// and concatenated). The conformance corpus itself now lives in cases/*.yaml
// (loaded by ./cases.ts); golden() just turns a program into bytes.
//

// Union the command sets a case declares via `needs` (replaces the old hardcoded
// `{ ...PrintCommands, ...gggtxFlowCommands }`).
export function commandsFor( needs: Subsystem[] ): Commands {
  const commands: Commands = {}
  for ( const n of needs ) Object.assign( commands, SUBSYSTEMS[ n ] )
  return commands
}

// Normalize trailing newlines so a terminal "\n" after the OK line (which the
// C++ machine emits but the TS reference does not) is not treated as a diff.
export function normalizeOutput( output: string ): string {
  return output.replace( /\n+$/, "" )
}

export async function golden( program: string, needs: Subsystem[] ): Promise<string> {
  const machine = new Machine( { commands: commandsFor( needs ) } )
  // Fixed register fixtures: "r" = [10,20,30] (1-D) for $r reference cases, and
  // "m" = a 2x3 matrix for offset references ($m@[...]) where the shape matters.
  const registers = machine.getRegisterList( Matrix )
  registers.add( new Matrix( { dim: [3], data: [10, 20, 30] } ), { name: "r" } )
  registers.add( new Matrix( { dim: [2, 3], data: [10, 11, 12, 13, 14, 15] } ), { name: "m" } )
  let out = ""
  const onOutput = ( line: any ) => { out += Format( line ) }
  machine.on( "output", onOutput )
  await machine.run( program )
  machine.off( "output", onOutput )
  return normalizeOutput( out )
}
