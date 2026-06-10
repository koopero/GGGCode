import { describe, test, expect } from "@jest/globals"

import { Hooks, GGG } from "../ts/ggg/Language"
import DocCommands from "../ts/gggdx/DocCommands"
import { ParseLines, ParseLine, ParseArg, Machine, Format } from "../ts/index"
import { gggMessage } from "../ts/ggg/Machine"


describe("Machine", () => {

  test("calls hooks", async () => {
    const machine = new Machine()

    const onCommand = jest.fn()
    const onCode = jest.fn()
    const onValue = jest.fn()
    const onEnd = jest.fn()

    machine.addCommands( {
      Q1: {
        [Hooks.Command]: onCommand,
        [Hooks.Value]: onValue,
        [Hooks.Code]: onCode,
        [Hooks.End]: ( arg ) => {
          arg.machine.outputOk()
          onEnd()
        },
      }
    })

    const result = await machine.run( "Q1 V2,3,4\n" )
    expect( result ).toEqual( [ { code: "OK", eol: true } ] )
    expect( onCommand ).toHaveBeenCalledTimes( 1 )
    expect( onCommand ).toHaveBeenCalledWith( expect.objectContaining( { machine, command: "Q1" } ) )
    expect( onCode ).toHaveBeenCalledTimes( 1 )
    expect( onCode ).toHaveBeenCalledWith( expect.objectContaining( { machine, command: "Q1", code: "V" } ) )
    expect( onValue ).toHaveBeenCalledTimes( 3 )
    expect( onValue ).toHaveBeenNthCalledWith( 1, expect.objectContaining( { machine, command: "Q1", code: "V", value:2 } ) )
    expect( onValue ).toHaveBeenNthCalledWith( 3, expect.objectContaining( { machine, command: "Q1", code: "V", value:4 } ) )
  })

  test(".output", () => {
    const machine = new Machine()
    const output = []
    machine.on( "output", line => output.push( line ) )
    machine.emit( "output", { args: [] } )
    expect( output ).toEqual( [ { args: [] } ] )
  })

  test("FailCommandNotFound", async () => {
    const machine = new Machine()
    const result = await machine.run( "Q1 V2,3,4\n" )
    expect( result[0].comment ).toContain( gggMessage.CommandNotFound )
  })

  test("silent OK", async () => {
    const machine = new Machine()

    const result = await machine.run( `OK
      ok
      ` )
    expect( result ).toEqual( [] )
  })

  test("echoes the O<id> request id on the return", async () => {
    const machine = new Machine()
    machine.addCommands( {
      Q1: { [Hooks.End]: ( arg ) => arg.machine.outputOk() },
    } )
    // No O arg -> default id 1 -> OK.
    expect( await machine.run( "Q1 V2\n" ) ).toEqual( [ { code: "OK", eol: true } ] )
    // Explicit O<id> -> echoed on the terminator (and never seen as command data).
    expect( await machine.run( "Q1 V2 O7\n" ) ).toEqual( [ { code: "O7", eol: true } ] )
  })

  test("failure return carries an F<code> arg alongside the echoed id", async () => {
    const machine = new Machine()
    machine.addCommands( {
      Q1: { [Hooks.End]: ( arg ) => arg.machine.outputFail( 5, "nope" ) },
    } )
    const [ ret ] = await machine.run( "Q1 O3\n" )
    expect( ret.code ).toEqual( "O3" )              // id echoed
    expect( ret.args?.[ 0 ]?.code ).toEqual( "F5" ) // failure code (the F arg = failure)
    expect( ret.comment ).toEqual( "nope" )
  })

})

