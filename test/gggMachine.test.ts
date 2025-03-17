import { describe, test, expect } from "@jest/globals"

import { gggHooks, GGG } from "../src/ggg/gggLang"
import gggdxCommands from "../src/gggdx/gggdxCommands"
import { gggParseLines, gggParseLine, gggParseArgument, gggMachine, Format } from "../src/index"
import { gggMessage } from "../src/ggg/gggMachine"


describe("gggMachine", () => {

  test("calls hooks", async () => {
    const machine = new gggMachine()

    const onCommand = jest.fn()
    const onCode = jest.fn()
    const onValue = jest.fn()
    const onEnd = jest.fn()

    machine.addCommands( {
      Q1: {
        [gggHooks.Command]: onCommand,
        [gggHooks.Value]: onValue,
        [gggHooks.Code]: onCode,
        [gggHooks.End]: ( arg ) => {
          arg.machine.outputOk()
          onEnd()
        },
      }
    })

    const result = await machine.run( "Q1 V2,3,4\n" )
    expect( result ).toEqual( [ { code: "OK" } ] )
    expect( onCommand ).toHaveBeenCalledTimes( 1 )
    expect( onCommand ).toHaveBeenCalledWith( expect.objectContaining( { machine, command: "Q1" } ) )
    expect( onCode ).toHaveBeenCalledTimes( 1 )
    expect( onCode ).toHaveBeenCalledWith( expect.objectContaining( { machine, command: "Q1", code: "V" } ) )
    expect( onValue ).toHaveBeenCalledTimes( 3 )
    expect( onValue ).toHaveBeenNthCalledWith( 1, expect.objectContaining( { machine, command: "Q1", code: "V", value:2 } ) )
    expect( onValue ).toHaveBeenNthCalledWith( 3, expect.objectContaining( { machine, command: "Q1", code: "V", value:4 } ) )
  })

  test(".output", () => {
    const machine = new gggMachine()
    const output = []
    machine.on( "output", line => output.push( line ) )
    machine.emit( "output", { args: [] } )
    expect( output ).toEqual( [ { args: [] } ] )
  })

  test("FailCommandNotFound", async () => {
    const machine = new gggMachine()
    const result = await machine.run( "Q1 V2,3,4\n" )
    expect( result[0].comment ).toContain( gggMessage.CommandNotFound )
  })

  test("silent OK", async () => {
    const machine = new gggMachine()

    const result = await machine.run( `OK
      ok
      ` )
    expect( result ).toEqual( [] )
  })

})

