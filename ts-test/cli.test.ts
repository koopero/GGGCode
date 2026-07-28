import { mkdtempSync, readFileSync, rmSync } from "fs"
import { tmpdir } from "os"
import { join } from "path"
import { decode } from "fast-png"
import Machine from "../ts/ggg/Machine"
import { GXCommands } from "../ts/ggggx/GXCommands"
import { Runner } from "../ts/stream/Runner"
import { attachPNGOutput, formatOutputPath, parseCLI } from "../ts/cli"

describe( "CLI output", () => {
  test( "parses -o and --output", () => {
    expect( parseCLI( [ "-o", "frame-%04d.png" ] ).output )
      .toEqual( "frame-%04d.png" )
    expect( parseCLI( [ "--output", "latest.png" ] ).output )
      .toEqual( "latest.png" )
    expect( parseCLI( [ "--image", "old.png" ] ).output ).toBeUndefined()
  } )

  test( "formats zero-based output sequences", () => {
    expect( formatOutputPath( "frame-%d.png", 0 ) ).toEqual( "frame-0.png" )
    expect( formatOutputPath( "frame-%04d.png", 12 ) ).toEqual( "frame-0012.png" )
    expect( formatOutputPath( "frame.png", 12 ) ).toEqual( "frame.png" )
    expect( formatOutputPath( "rate-%%-%02d.png", 3 ) ).toEqual( "rate-%-03.png" )
  } )

  test( "writes one numbered PNG for each G13", async () => {
    const directory = mkdtempSync( join( tmpdir(), "ggg-cli-output-" ) )
    try {
      const machine = new Machine( { commands: GXCommands } )
      const runner = new Runner( { machine } )
      attachPNGOutput( machine, join( directory, "frame-%02d.png" ) )

      await runner.run( `
        G30 L"frame" S1,2,2
        G20 R"frame" V0,0,0,0
        G13 R"frame"
        G20 R"frame" V1,1,1,1
        G13 R"frame"
      ` )

      const first = decode( readFileSync( join( directory, "frame-00.png" ) ) )
      const second = decode( readFileSync( join( directory, "frame-01.png" ) ) )
      expect( [ ...first.data ] ).toEqual( [ 0, 0, 0, 0 ] )
      expect( [ ...second.data ] ).toEqual( [ 255, 255, 255, 255 ] )
    } finally {
      rmSync( directory, { recursive: true } )
    }
  } )
} )
