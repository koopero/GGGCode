import Machine from "../ggg/Machine"
import PrintCommands from "../gggpx/PrintCommands"
import Format from "../ggg/Format"

//
// Shared conformance corpus + the canonical "golden" output producer.
//
// The TypeScript implementation is the reference: golden() runs a program
// through the TS Machine and renders its output exactly as the CLI does
// (ts/cli.ts: each output item passed through Format() and concatenated).
// The C++ implementation must reproduce this output (see the generated
// cxx/test-pio/gen/conformance_cases.h and cxx/test-pio/test_conformance.cpp).
//
// Scope note: cases are currently limited to PrintNumbers (P10) with decimal
// values -- the behaviour both implementations share today. Hex-encoded values
// and string printing (P13) still diverge and are tracked as follow-up.
//

export type ConformanceCase = { name: string, program: string }

export const corpus: ConformanceCase[] = [
  { name: "print_single",    program: "P10 V42" },
  { name: "print_list",      program: "P10 V1,2,3" },
  { name: "print_zero",      program: "P10 V0" },
  { name: "print_negatives", program: "P10 V-5,-10,15" },
  { name: "print_two_args",  program: "P10 V1,2,3 V4,5,6" },
  { name: "print_bytes",     program: "P10 V255,128,64" },
]

// Normalize trailing newlines so a terminal "\n" after the OK line (which the
// C++ machine emits but the TS reference does not) is not treated as a diff.
export function normalizeOutput( output: string ): string {
  return output.replace( /\n+$/, "" )
}

export async function golden( program: string ): Promise<string> {
  const machine = new Machine( { commands: PrintCommands } )
  let out = ""
  const onOutput = ( line: any ) => { out += Format( line ) }
  machine.on( "output", onOutput )
  await machine.run( program )
  machine.off( "output", onOutput )
  return normalizeOutput( out )
}
