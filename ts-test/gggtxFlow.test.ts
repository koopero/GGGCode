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

// Runaway recursion: a procedure that runs ITSELF. Both engines bound this by
// the work budget and must spend it at the SAME point -- the identical assertion
// lives in cxx test_flow_procedures. Depth-first re-insertion keeps the queue
// shallow, so a depth check alone never catches this; and the budget counts only
// machine-enqueued work, so host input does not shift where it trips.
describe( "gggtx recursion guard", () => {
  test( "a self-running procedure terminates at the work budget", async () => {
    const machine = new Machine( {
      commands: { ...PrintCommands, ...gggtxFlowCommands },
      limits: { maxQueue: 10 },
    } )
    let out = ""
    machine.on( "output", ( line: any ) => { out += Format( line ) } )
    await machine.run( [
      'T10 L"boom"',
      "P10 V1",
      'T11 R"boom"',
      "T0",
      'T11 R"boom"',
    ].join( "\n" ) )
    expect( out ).toEqual( "V1\nOK\nV1\nOK\nV1\nOK\nV1\nOK\nV1\nOK\nOK F2\n" )
  } )

  test( "the guard is on by default, without the embedder asking", async () => {
    const machine = new Machine( { commands: { ...PrintCommands, ...gggtxFlowCommands } } )
    let lines = 0
    machine.on( "output", () => lines++ )
    await machine.run( [
      'T10 L"boom"',
      "P10 V1",
      'T11 R"boom"',
      "T0",
      'T11 R"boom"',
    ].join( "\n" ) )
    // Terminates at all -- the point of the default. 1024 bodies -> ~2k lines.
    expect( lines ).toBeGreaterThan( 0 )
    expect( lines ).toBeLessThan( 2100 )
  } )
} )

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
      'T11 R"p"',
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
      'T11 R"p"',
    ].join( "\n" ) )
    expect( out ).toEqual( "V2\nOK" )
  } )

  test( "running an unknown procedure reports failure", async () => {
    const out = await runFlow( 'T11 R"nope"' )
    expect( out ).toEqual( "OK F6" )   // OK (id 1) + F6 = GGGFail.ProcedureNotFound
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

    await machine.run( 'T11 R"outer"' )      // defines inner, no body output
    expect( normalizeOutput( out ) ).toEqual( "" )
    expect( machine.getRegisterList( TProcedure ).named["inner"] ).toBeDefined()

    await machine.run( 'T11 R"inner"' )      // now runs inner
    expect( normalizeOutput( out ) ).toEqual( "V7\nOK" )
  } )

  test( "a procedure can call another procedure", async () => {
    const out = await runFlow( [
      'T10 L"a"',
      "P10 V1",
      "T0",
      'T10 L"b"',
      'T11 R"a"',
      "P10 V2",
      "T0",
      'T11 R"b"',
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
      'T11 R"big"',
    ].join( "\n" ) )
    expect( normalizeOutput( out ) ).toEqual( "OK F2" )   // OK (id 1) + F2 = GGGFail.QueueOverflow
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

  test( "T9 Y runs if any value is truthy", async () => {
    expect( await runFlow( "T9 Y0,0,1\nP10 V42\nT0" ) ).toEqual( "V42\nOK" )
    expect( await runFlow( "T9 Y0,0,0\nP10 V42\nT0" ) ).toEqual( "" )
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
      'T11 R"p"',
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
      'T11 R"p"',
    ].join( "\n" ) )
    expect( out ).toEqual( "V1\nOK\nV2\nOK" )
  } )
} )
