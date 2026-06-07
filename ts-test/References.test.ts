import { describe, expect, test } from '@jest/globals'
import Machine from "../ts/ggg/Machine"
import Matrix from "../ts/ggg/Matrix"
import Format from "../ts/ggg/Format"
import PrintCommands from "../ts/gggpx/PrintCommands"
import { normalizeOutput } from "../ts/cxx/conformance"

// Run a program against a machine holding a Matrix register "r" = [10,20,30].
async function runWithReg( program: string ): Promise<string> {
  const machine = new Machine( { commands: { ...PrintCommands } } )
  machine.getRegisterList( Matrix ).add( new Matrix( { dim: [3], data: [10, 20, 30] } ), { name: "r" } )
  let out = ""
  const onOutput = ( line: any ) => { out += Format( line ) }
  machine.on( "output", onOutput )
  await machine.run( program )
  machine.off( "output", onOutput )
  return normalizeOutput( out )
}

describe( "references", () => {
  test( "bare $name reads the whole register in order", async () => {
    expect( await runWithReg( "P10 V$r" ) ).toEqual( "V10,20,30\nOK" )
  } )

  test( "$name[i] reads a single element", async () => {
    expect( await runWithReg( "P10 V$r[1]" ) ).toEqual( "V20\nOK" )
  } )

  test( "$name[range] reads a span", async () => {
    expect( await runWithReg( "P10 V$r[0:2]" ) ).toEqual( "V10,20,30\nOK" )
  } )

  test( "an unknown register yields no values (not register 0)", async () => {
    // No resolved values -> empty value line + OK (same as the multiaxis case).
    expect( await runWithReg( "P10 V$x" ) ).toEqual( "\nOK" )
  } )
} )
