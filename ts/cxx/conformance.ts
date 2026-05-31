import Machine from "../ggg/Machine"
import PrintCommands from "../gggpx/PrintCommands"
import Format from "../ggg/Format"

//
// Shared language conformance corpus + the canonical "golden" output producer.
//
// The TypeScript implementation is the reference: golden() runs a program
// through the TS Machine and renders its output exactly as the CLI does
// (ts/cli.ts: each output item passed through Format() and concatenated).
//
// Every case is exercised against the TS reference (ts-test/conformance.test.ts).
// Cases without `cxxSkip` are also compiled into the C++ test and must produce
// byte-identical output there (cxx/test-pio/gen/conformance_cases.h). A case
// tagged with `cxxSkip` documents a known TS<->C++ divergence to reconcile when
// the C++ port catches up; drop the flag once it matches.
//
// Programs use PrintNumbers (P10), which echoes resolved values back, so the
// output exercises the parser + number/encoding formatting end to end.
//

export type ConformanceCase = {
  name: string
  program: string
  cxxSkip?: string
}

export const corpus: ConformanceCase[] = [
  // --- decimals, lists, signs ---
  { name: "print_single",    program: "P10 V42" },
  { name: "print_list",      program: "P10 V1,2,3" },
  { name: "print_zero",      program: "P10 V0" },
  { name: "print_negatives", program: "P10 V-5,-10,15" },
  { name: "print_two_args",  program: "P10 V1,2,3 V4,5,6" },
  { name: "print_bytes",     program: "P10 V255,128,64" },
  { name: "print_decimal",   program: "P10 V-1.5" },

  // --- unitary constants (ASCII): K=1, Z=0, N=-1 ---
  { name: "unitary_one",      program: "P10 VK" },
  { name: "unitary_zero",     program: "P10 VZ" },
  { name: "unitary_minusone", program: "P10 VN" },

  // --- unicode characters decode to their codepoint ---
  { name: "unicode_snowman", program: "P10 V☃" },
  { name: "unicode_cjk",     program: "P10 V你" },
  { name: "unicode_greek",   program: "P10 Vα" },
  { name: "unicode_euro",    program: "P10 V€" },
  { name: "unicode_emoji",   program: "P10 V😀" },
  { name: "unicode_list",    program: "P10 V☃,你" },

  // --- hex integers (0X) ---
  { name: "hex_1f",   program: "P10 V0X1F" },
  { name: "hex_ff",   program: "P10 V0XFF" },
  { name: "hex_zero", program: "P10 V0X0" },
  { name: "hex_100",  program: "P10 V0X100" },

  // --- hex list (0I: one nibble per digit) ---
  { name: "hexlist_ff00", program: "P10 V0IFF00" },

  // --- known TS<->C++ divergences (TS reference only for now) ---
  { name: "unitary_pi",  program: "P10 Vπ", cxxSkip: "symbolic unitary constants (π τ e φ γ) decode as codepoints in C++" },
  { name: "unitary_tau", program: "P10 Vτ", cxxSkip: "symbolic unitary constants (π τ e φ γ) decode as codepoints in C++" },
  { name: "unitary_e",   program: "P10 Ve", cxxSkip: "symbolic unitary constants (π τ e φ γ) decode as codepoints in C++" },
  { name: "hexnorm2_80", program: "P10 V0H80", cxxSkip: "fractional hex-norm precision differs (C++ float vs TS double)" },
  { name: "hexnorm1_8",  program: "P10 V0J8", cxxSkip: "fractional hex-norm precision differs (C++ float vs TS double)" },
  { name: "range_incl",  program: "P10 V1:5", cxxSkip: "range expansion not yet implemented in the C++ parser" },
  { name: "range_excl",  program: "P10 V1>5", cxxSkip: "range expansion not yet implemented in the C++ parser" },
  { name: "range_count", program: "P10 V0:10/5", cxxSkip: "range expansion not yet implemented in the C++ parser" },
  { name: "range_step",  program: "P10 V0:10:2", cxxSkip: "range expansion not yet implemented in the C++ parser" },
  { name: "multiaxis",   program: "P10 V1|2|3", cxxSkip: "multi-axis (|) handling differs between implementations" },
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
