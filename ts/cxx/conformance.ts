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

// The fixed register fixtures every case runs against, in add order (so R index
// matches: r=0, m=1, bs=2, bd=3). Exported so the docs renderer can draw the same
// source/shape it knows the cases were authored against, without re-running.
//   r  = [10,20,30] (1-D) for $r reference cases
//   m  = 2x3 matrix for offset references ($m@[...]) where the shape matters
//   bs = 3x3 [1..9] blit source; bd = 3x3 zeroed blit destination (read back via G10)
export const FIXTURES: { name: string, dim: number[], data: number[] }[] = [
  { name: "r", dim: [3], data: [10, 20, 30] },
  { name: "m", dim: [2, 3], data: [10, 11, 12, 13, 14, 15] },
  { name: "bs", dim: [3, 3], data: [1, 2, 3, 4, 5, 6, 7, 8, 9] },
  { name: "bd", dim: [3, 3], data: [0, 0, 0, 0, 0, 0, 0, 0, 0] },
]

export function setupFixtures( machine: Machine ): void {
  const registers = machine.getRegisterList( Matrix )
  for ( const { name, dim, data } of FIXTURES ) {
    registers.add( new Matrix( { dim, data: [ ...data ] } ), { name } )
  }
}

// `polls` are host clock times to call poll() at once the program has run, which
// is how async procedures (T12) get driven -- the machine has no clock of its
// own, so the corpus supplies one and the result stays deterministic.
export async function golden( program: string, needs: Subsystem[], polls: number[] = [] ): Promise<string> {
  const machine = new Machine( { commands: commandsFor( needs ) } )
  setupFixtures( machine )
  let out = ""
  const onOutput = ( line: any ) => { out += Format( line ) }
  machine.on( "output", onOutput )
  await machine.run( program )
  for ( const now of polls ) await machine.poll( now )
  machine.off( "output", onOutput )
  return normalizeOutput( out )
}
