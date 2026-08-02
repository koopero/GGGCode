import Format from "../ts/ggg/Format"
import KitchenSinkMachine from "../ts/KitchenSinkMachine"

describe( "KitchenSinkMachine", () => {
  test( "installs every TypeScript subsystem", () => {
    const machine = new KitchenSinkMachine()

    expect( machine.commands ).toEqual( expect.objectContaining( {
      P10: expect.any( Object ),
      G30: expect.any( Object ),
      T10: expect.any( Object ),
      D1: expect.any( Object ),
    } ) )
  } )

  test( "runs real ggggx buffers and describes their live references", async () => {
    const machine = new KitchenSinkMachine()
    let output = ""
    machine.on( "output", token => { output += Format( token ) } )

    await machine.run( `
      G30 L"frame" S3 T"UNorm8"
      G20 R"frame" V0,0.5,1
      G10 R"frame"
      D1
    ` )

    expect( output ).toContain( 'G20 R0 P0 V0H007fff' )
    expect( output ).toContain( 'D-40 B"G40" T"command"' )
    expect( output ).toContain( 'D-40 B"T11" T"command"' )
    expect( output ).toContain( 'D-50 R10 L"ggggx.register" S1 T"reference"' )
    expect( output ).toContain( 'D-51 R10 V0 L"frame"' )
  } )

  test( "allows normal Machine command overrides", async () => {
    const machine = new KitchenSinkMachine( {
      commands: {
        X1: {
          description: "Test override",
          hookEnd: ( { machine }:any ) => machine.outputOk( "custom" ),
        },
      },
    } )

    const output = ( await machine.run( "X1" ) ).map( Format ).join( "" )
    expect( output ).toContain( "; custom" )
  } )
} )
