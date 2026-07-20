import { readFileSync } from "fs"
import { resolve } from "path"
import { loadCases, decodeOutput, valuesMatch } from "../ts/cxx/cases"
import { golden } from "../ts/cxx/conformance"

//
// Guards the TS reference + the committed golden artifacts. The C++ side runs the
// same cases against the same golden (cxx/test-pio/test_ggg.cpp): when both this
// suite and the PlatformIO test are green the two implementations agree.
//
// The cross-engine contract is the decoded `values` stream within a global epsilon
// (cases.ts decodeOutput/valuesMatch), plus the control `status`; byte `expected`
// is enforced only for `exact` cases. Regenerate with `npm run build:conformance`.
//

type GoldenRecord = {
  name: string, program: string, status: string, values: number[],
  exact: boolean, expected: string, needs: ( "gggpx" | "gggtx" | "ggggx" )[], tags: string[], description: string
}

const stored: GoldenRecord[] = JSON.parse(
  readFileSync( resolve( __dirname, "../conformance/golden.json" ), "utf8" )
)
const cases = loadCases()
const byName = new Map( stored.map( r => [ r.name, r ] ) )

describe( "conformance", () => {
  test( "golden.json is in sync with cases/*.yaml", () => {
    expect( stored.map( r => r.name ) ).toEqual( cases.map( c => c.name ) )
    expect( stored.map( r => r.program ) ).toEqual( cases.map( c => c.program ) )
  } )

  for ( const c of cases ) {
    test( `TS reference: ${c.name}`, async () => {
      const out = await golden( c.program, c.needs, c.polls )
      const { values, statuses } = decodeOutput( out )

      // value-tolerance contract (the hand-authored ground truth)
      if ( !valuesMatch( values, c.values ) ) {
        throw new Error( `values ${JSON.stringify( values )} != authored ${JSON.stringify( c.values )}` )
      }

      // control status: "" => no response; else every response equals status
      if ( c.status === "" ) {
        expect( statuses ).toEqual( [] )
      } else {
        expect( statuses.length ).toBeGreaterThan( 0 )
        expect( statuses.every( s => s === c.status ) ).toBe( true )
      }

      // opt-in byte exactness, where formatting itself is the test
      if ( c.exact ) expect( out ).toEqual( byName.get( c.name )!.expected )
    } )
  }
} )
