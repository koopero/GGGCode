import { readFileSync } from "fs"
import { resolve } from "path"
import { corpus, golden } from "../ts/cxx/conformance"

//
// Guards the TS reference + the committed golden artifacts. The C++ side runs
// the same corpus against the same golden (cxx/test-pio/test_ggg.cpp), so when
// both this suite and the PlatformIO test are green the two implementations
// agree. Regenerate with `npm run build:conformance`.
//

type GoldenRecord = { name: string, program: string, expected: string }

const stored: GoldenRecord[] = JSON.parse(
  readFileSync( resolve( __dirname, "../conformance/golden.json" ), "utf8" )
)

describe( "conformance", () => {
  test( "golden.json is in sync with the corpus", () => {
    expect( stored.map( r => r.name ) ).toEqual( corpus.map( c => c.name ) )
    expect( stored.map( r => r.program ) ).toEqual( corpus.map( c => c.program ) )
  } )

  for ( const record of stored ) {
    test( `TS reference output: ${record.name}`, async () => {
      expect( await golden( record.program ) ).toEqual( record.expected )
    } )
  }
} )
