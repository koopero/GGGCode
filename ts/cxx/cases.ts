import { readdirSync, readFileSync } from "fs"
import { resolve } from "path"
import { parse } from "yaml"
import { Commands, GGG } from "../ggg/Language"
import PrintCommands from "../gggpx/PrintCommands"
import { gggtxFlowCommands } from "../gggtx/gggtxCommands"
import { GXCommands } from "../ggggx/GXCommands"

//
// Human-authored conformance cases (cases/*.yaml). A case is one artifact wearing
// four hats: behavioural spec, per-feature documentation, runnable example, and
// cross-engine conformance test. See the design memory [ggg-conformance-yaml-concept].
//
// The cross-engine contract is the DECODED `values` stream compared within a
// single global epsilon (not raw bytes) — this smooths the C++ float vs TS double
// divergence that used to force `cxxSkip`. Byte `expected` is an opt-in per-case
// exactness check, only where the formatting itself is the thing under test.
//

export const EPSILON = 1e-4

export type Subsystem = "gggpx" | "gggtx" | "ggggx"

export type Case = {
  name: string          // stable id
  description: string   // documentation + spec sentence
  needs: Subsystem[]    // subsystem requirements (harness loading + C++ gating)
  tags: string[]        // soft curation / feature grouping
  program: string       // the example AND the conformance input
  values: number[]      // hand-authored ground-truth data stream (tolerance-compared)
  status: string        // control response: "OK" (default), "OZ", or "" (none)
  exact: boolean        // OPT-IN byte check: also assert the generated `expected`
                        // bytes match, where formatting itself is the test
}

// Command sets keyed by subsystem requirement. `golden()` loads exactly the union
// declared by a case's `needs`, replacing the old hardcoded command bundle.
export const SUBSYSTEMS: Record<Subsystem, Commands> = {
  gggpx: PrintCommands,
  gggtx: gggtxFlowCommands,
  ggggx: GXCommands,
}

// Subsystems the C++ conformance machine provides (cxx test_ggg.cpp
// ConformanceMachine). A case compiles into conformance_cases.h iff its `needs`
// are all satisfied here — a genuine capability gap is the only reason a case is
// C++-excluded (replacing hand-typed `cxxSkip`).
export const CXX_SUBSYSTEMS: Subsystem[] = [ "gggpx", "gggtx" ]

export function cxxSupported( c: Case ): boolean {
  return c.needs.every( n => CXX_SUBSYSTEMS.includes( n ) )
}

const casesDir = resolve( __dirname, "../../cases" )

// Glob cases/*.yaml (sorted by filename for stable order) and flatten every
// document list into one corpus.
export function loadCases(): Case[] {
  const files = readdirSync( casesDir ).filter( f => f.endsWith( ".yaml" ) ).sort()
  const out: Case[] = []
  for ( const file of files ) {
    const docs = parse( readFileSync( resolve( casesDir, file ), "utf8" ) )
    if ( !Array.isArray( docs ) ) continue
    for ( const raw of docs ) out.push( validateCase( raw, file ) )
  }
  return out
}

function validateCase( raw: any, file: string ): Case {
  const where = `${file}: ${raw?.name ?? "(unnamed)"}`
  if ( !raw || typeof raw.name !== "string" ) throw new Error( `${where}: missing name` )
  if ( typeof raw.program !== "string" ) throw new Error( `${where}: missing program` )
  if ( !Array.isArray( raw.values ) ) throw new Error( `${where}: missing values[]` )
  const needs: Subsystem[] = raw.needs ?? []
  for ( const n of needs ) {
    if ( !( n in SUBSYSTEMS ) ) throw new Error( `${where}: unknown need "${n}"` )
  }
  return {
    name: raw.name,
    description: raw.description ?? "",
    needs,
    tags: raw.tags ?? [],
    // YAML block scalars (program: |) carry a trailing newline; programs are
    // authored without one, so drop a single trailing newline.
    program: raw.program.replace( /\n$/, "" ),
    values: raw.values.map( Number ),
    status: raw.status ?? "OK",
    exact: raw.exact === true,
  }
}

//
// Decode a rendered output back into its value stream + control responses, by
// re-parsing the text (the same logic ports to C++). Output is always a decimal
// value-list: space-separated args, each `‹code›‹d,d,d›`, with the okay response
// (O-prefixed, e.g. OK/OZ) on its own line.
//
// Assumes print-style output (every arg carries decimal values). ggggx read-style
// output (G20 R0 P0 V…, where R/P are addresses) would need slot-awareness — not
// in this corpus and ggggx is C++-excluded, so deferred.
//
export function decodeOutput( text: string ): { values: number[], statuses: string[] } {
  const values: number[] = []
  const statuses: string[] = []
  for ( const line of text.split( "\n" ) ) {
    if ( line === "" ) continue
    if ( line[0] === GGG.Okay ) { statuses.push( line ); continue }
    for ( const arg of line.split( " " ) ) {
      if ( !arg ) continue
      const data = arg.slice( 1 )                 // drop the leading code char
      for ( const piece of data.split( "," ) ) {
        if ( piece === "" ) continue
        const n = parseFloat( piece )
        if ( !Number.isNaN( n ) ) values.push( n )
      }
    }
  }
  return { values, statuses }
}

export function valuesMatch( a: number[], b: number[], eps: number = EPSILON ): boolean {
  if ( a.length !== b.length ) return false
  for ( let i = 0; i < a.length; i++ ) {
    if ( Math.abs( a[i] - b[i] ) > eps ) return false
  }
  return true
}
