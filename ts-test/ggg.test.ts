import { describe, test, expect } from "@jest/globals"

import { gggHooks, GGG } from "../ts/ggg/gggLang"
import gggdxCommands from "../ts/gggdx/gggdxCommands"
import { gggParseLines, gggParseLine, gggParseArgument, gggMachine, Format } from "../ts/index"

describe("ggg", () => {
  test("smork", () => {
    const lines = gggParseLines( ` G-1 X20 Y300,4000; Comment` )

    const line = lines[0]

    const { comment, args } = line

    expect( comment ).toBe("; Comment")
    expect( args.length ).toBe( 2 )
    expect( args[0] ).toMatchObject( {
      col: 6,
      code: "X",
      len: 3,
      data: [20],
    })
    expect( args[1] ).toMatchObject( {
      col: 10,
      code: "Y",
      len: 9,
      data: [300,4000],
    })
  })
})

describe("gggParseLine", () => {
  test("after string", () => {
    const [ line, remain ] = gggParseLine( `G1 N"Hello \\"World!\\"" X20; Comment` )
    expect( line ).toMatchObject( {
      command: "G1",
      comment: "; Comment",
      args: [
        {
          code: "N",
          data: [ "Hello \"World!\"" ],
        },
        {
          code: "X",
          data: [20],
        },
      ]
    })
  })

  test("after string list", () => {
    const [ line, remain ] = gggParseLine( `G1 N"Hello","World" X20; Comment` )
    expect( line ).toMatchObject( {
      command: "G1",
      comment: "; Comment",
      args: [
        {
          code: "N",
          data: [ "Hello","World" ],
        },
        {
          code: "X",
          data: [20],
        },
      ]
    })
  })
})




describe("gggdx", () => {
  test("will work", async () => {
    const machine = new gggMachine()
    machine.addCommands( gggdxCommands )
    const result = await machine.run( "D1" )
  })
})

