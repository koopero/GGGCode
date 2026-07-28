import Machine from "../ts/ggg/Machine"
import { Runner } from "../ts/stream/Runner"
import BuiltinCommands from "../ts/builtin"

describe("Runner", () => {
  test("resolves on OK and collects the response lines (D1 language description)", async () => {
    const machine = new Machine( { commands: BuiltinCommands } )
    const runner = new Runner( { machine } )

    const [ result ] = await runner.run( "D1\n" )

    expect( result.status ).toBe( "ok" )                 // not a timeout
    expect( result.tokens.length ).toBeGreaterThan( 0 )  // catalog collected
    // The terminator itself is not part of the result.
    expect( result.tokens.some( t => ( t.command || t.code || "" ).startsWith( "O" ) ) ).toBe( false )
    // D1 documents itself.
    expect( result.lines.join( "\n" ) ).toContain( "D1" )

    expect( runner.running ).toBeNull()
    expect( runner.queue ).toHaveLength( 0 )
  })

  test("times out when no response arrives (write callback, nothing fed back)", async () => {
    const sent: string[] = []
    const runner = new Runner( { write: ( s ) => sent.push( s ) } )

    const [ result ] = await runner.run( "D1\n", { timeout: 50 } )

    expect( result.status ).toBe( "timeout" )
    expect( sent ).toContain( "D1\n" )      // the command was still transmitted
    expect( runner.running ).toBeNull()
  })

  test("runs queued commands sequentially", async () => {
    const machine = new Machine( { commands: BuiltinCommands } )
    const runner = new Runner( { machine } )

    const results = await runner.run( "D1\nD1\n" )

    expect( results ).toHaveLength( 2 )
    expect( results.every( r => r.status === "ok" ) ).toBe( true )
    expect( runner.running ).toBeNull()
  })
})
