import { describe, expect, test } from '@jest/globals'
import Machine from "../ts/ggg/Machine"
import Format from "../ts/ggg/Format"
import PrintCommands from "../ts/gggpx/PrintCommands"
import { gggtxFlowCommands, TProcedure } from "../ts/gggtx/gggtxCommands"
import { normalizeOutput } from "../ts/cxx/conformance"

// Run a program through a machine that knows both the print command (P10, used
// to make body execution observable) and the flow commands (T0/T10/T11).
async function runFlow( program: string ): Promise<string> {
  const machine = new Machine( {
    commands: { ...PrintCommands, ...gggtxFlowCommands },
    limits: { maxQueue: 1000 },
  } )
  let out = ""
  const onOutput = ( line: any ) => { out += Format( line ) }
  machine.on( "output", onOutput )
  await machine.run( program )
  machine.off( "output", onOutput )
  return normalizeOutput( out )
}

describe( "gggtx procedures", () => {
  test( "defining a procedure does not execute its body", async () => {
    const out = await runFlow( [
      'T10 L"p"',
      "P10 V42",
      "T0",
    ].join( "\n" ) )
    expect( out ).toEqual( "" )
  } )

  test( "running a procedure executes its body in order", async () => {
    const out = await runFlow( [
      'T10 L"p"',
      "P10 V1",
      "P10 V2",
      "T0",
      'T11 L"p"',
    ].join( "\n" ) )
    expect( out ).toEqual( "V1\nOK\nV2\nOK" )
  } )

  test( "redefining a procedure overwrites the previous body", async () => {
    const out = await runFlow( [
      'T10 L"p"',
      "P10 V1",
      "T0",
      'T10 L"p"',
      "P10 V2",
      "T0",
      'T11 L"p"',
    ].join( "\n" ) )
    expect( out ).toEqual( "V2\nOK" )
  } )

  test( "running an unknown procedure returns O0", async () => {
    const out = await runFlow( 'T11 L"nope"' )
    expect( out ).toEqual( "OZ" )
  } )

  test( "nested definition is captured as source and runs only when outer runs", async () => {
    // Defining "outer" must NOT define "inner" (its T10/T0 are captured as
    // text). Running "outer" defines "inner"; running "inner" then executes it.
    const machine = new Machine( {
      commands: { ...PrintCommands, ...gggtxFlowCommands },
      limits: { maxQueue: 1000 },
    } )
    let out = ""
    machine.on( "output", ( line: any ) => { out += Format( line ) } )

    await machine.run( [
      'T10 L"outer"',
      'T10 L"inner"',
      "P10 V7",
      "T0",
      "T0",
    ].join( "\n" ) )
    // inner is not defined yet
    expect( machine.getRegisterList( TProcedure ).named["inner"] ).toBeUndefined()

    await machine.run( 'T11 L"outer"' )      // defines inner, no body output
    expect( normalizeOutput( out ) ).toEqual( "" )
    expect( machine.getRegisterList( TProcedure ).named["inner"] ).toBeDefined()

    await machine.run( 'T11 L"inner"' )      // now runs inner
    expect( normalizeOutput( out ) ).toEqual( "V7\nOK" )
  } )

  test( "a procedure can call another procedure", async () => {
    const out = await runFlow( [
      'T10 L"a"',
      "P10 V1",
      "T0",
      'T10 L"b"',
      'T11 L"a"',
      "P10 V2",
      "T0",
      'T11 L"b"',
    ].join( "\n" ) )
    expect( out ).toEqual( "V1\nOK\nV2\nOK" )
  } )

  test( "enqueueLines respects maxQueue (bounded growth)", async () => {
    const machine = new Machine( {
      commands: { ...PrintCommands, ...gggtxFlowCommands },
      limits: { maxQueue: 2 },
    } )
    let out = ""
    machine.on( "output", ( line: any ) => { out += Format( line ) } )
    // Body of 5 lines cannot fit into a queue capped at 2 -> O0, no body output.
    await machine.run( [
      'T10 L"big"',
      "P10 V1",
      "P10 V2",
      "P10 V3",
      "P10 V4",
      "P10 V5",
      "T0",
      'T11 L"big"',
    ].join( "\n" ) )
    expect( normalizeOutput( out ) ).toEqual( "OZ" )
  } )
} )

describe( "gggtx conditionals", () => {
  test( "T9 A1 runs its body", async () => {
    expect( await runFlow( "T9 A1\nP10 V42\nT0" ) ).toEqual( "V42\nOK" )
  } )

  test( "T9 A0 skips its body", async () => {
    expect( await runFlow( "T9 A0\nP10 V42\nT0" ) ).toEqual( "" )
  } )

  test( "T9 A requires all values truthy", async () => {
    expect( await runFlow( "T9 A1,1\nP10 V42\nT0" ) ).toEqual( "V42\nOK" )
    expect( await runFlow( "T9 A1,0\nP10 V42\nT0" ) ).toEqual( "" )
  } )

  test( "T9 O runs if any value is truthy", async () => {
    expect( await runFlow( "T9 O0,0,1\nP10 V42\nT0" ) ).toEqual( "V42\nOK" )
    expect( await runFlow( "T9 O0,0,0\nP10 V42\nT0" ) ).toEqual( "" )
  } )

  test( "a skipped conditional consumes a nested block", async () => {
    // The false outer block must swallow the inner T9/T0 (captured, never run),
    // and execution resumes correctly after the outer T0.
    const out = await runFlow( [
      "T9 A0",
      "T9 A1",
      "P10 V1",
      "T0",
      "T0",
      "P10 V2",
    ].join( "\n" ) )
    expect( out ).toEqual( "V2\nOK" )
  } )

  test( "a true conditional runs a nested conditional", async () => {
    const out = await runFlow( [
      "T9 A1",
      "T9 A1",
      "P10 V1",
      "T0",
      "T0",
    ].join( "\n" ) )
    expect( out ).toEqual( "V1\nOK" )
  } )

  test( "a procedure body may contain conditionals", async () => {
    const out = await runFlow( [
      'T10 L"p"',
      "T9 A1",
      "P10 V1",
      "T0",
      "T9 A0",
      "P10 V2",
      "T0",
      "T0",
      'T11 L"p"',
    ].join( "\n" ) )
    expect( out ).toEqual( "V1\nOK" )
  } )
} )

describe( "gggtx iteration", () => {
  test( "T9 V iterates the body once per value, exposing $name", async () => {
    const out = await runFlow( 'T9 V10,20,30 R"it"\nP10 V$it\nT0' )
    expect( out ).toEqual( "V10\nOK\nV20\nOK\nV30\nOK" )
  } )

  test( "T9 V expands a range", async () => {
    const out = await runFlow( 'T9 V0:3 R"it"\nP10 V$it\nT0' )
    expect( out ).toEqual( "V0\nOK\nV1\nOK\nV2\nOK\nV3\nOK" )
  } )

  test( "the iteration register is addressable by index", async () => {
    const out = await runFlow( "T9 V7,8 R0\nP10 V$0\nT0" )
    expect( out ).toEqual( "V7\nOK\nV8\nOK" )
  } )

  test( "T9 V with no values runs the body zero times", async () => {
    const out = await runFlow( 'T9 V$x R"it"\nP10 V$it\nT0' )
    expect( out ).toEqual( "" )
  } )

  test( "iteration inside a procedure body", async () => {
    const out = await runFlow( [
      'T10 L"p"',
      'T9 V1,2 R"i"',
      "P10 V$i",
      "T0",
      "T0",
      'T11 L"p"',
    ].join( "\n" ) )
    expect( out ).toEqual( "V1\nOK\nV2\nOK" )
  } )
} )
