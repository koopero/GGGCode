import { describe, test, expect } from "@jest/globals"

import { gggHooks } from "../ts/ggg/gggLang"
import gggdxCommands from "../ts/gggdx/gggdxCommands"
import { gggParseLines, gggParseLine, gggParseArgument, gggMachine, gggFormat } from "../ts/index"

describe("ggg", () => {
  test("smork", () => {
    const lines = gggParseLines( ` G-1 X20 Y300,4000; Comment  Foo` )

    const line = lines[0]

    const { comment, args } = line

    expect( comment ).toBe("; Comment  Foo")
    expect( args.length ).toBe( 2 )
    expect( args[0] ).toMatchObject( {
      col: 6,
      code: "X",
      data: [20],
    })
    expect( args[1] ).toMatchObject( {
      col: 10,
      code: "Y",
      // len: 5,
      data: [300,4000],
    })
  })
})

describe("data", () => {
  test("Mixed data", () => {
    const [ token, remain ] = gggParseArgument( `XZ0x10,3.5e3,"String"`)
    const { data } = token

    expect( data ).toEqual( [0,16,3500,"String"] )
  })
})
