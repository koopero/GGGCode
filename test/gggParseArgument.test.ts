import { describe, test, expect } from "@jest/globals"
import { GGG } from "../src/ggg/gggLang"
import { gggParseArgument } from "../src/index"


describe("gggParseArgument", () => {
  describe("keepEncoding = false", () => {
    test("Quoted string", () => {
      const [ token, remain ] = gggParseArgument( `G"Hello \\"World!\\""`)
      expect( token ).toEqual( {
        col: 1,
        code: "G",
        len: 19,
        data: [ "Hello \"World!\"" ],
      })
    })

    test(`encoding: HexNorm2 (0${GGG.HexNorm2})`, () => {
      const [ token, remain ] = gggParseArgument( `G0${GGG.HexNorm2}FFF0`)
      expect( token ).toEqual( {
        col: 1,
        code: "G",
        len: 7,
        data: [1,240/255],
      })
    })

    test(`encoding: HexList2 (0${GGG.HexList2})`, () => {
      const [ token, remain ] = gggParseArgument( `G0${GGG.HexList2}FFF0`)
      expect( token ).toEqual( {
        col: 1,
        code: "G",
        len: 7,
        data: [255,240],
      })
    })


    test(`encoding: HexNorm1 (0${GGG.HexNorm1})`, () => {
      const [ token, remain ] = gggParseArgument( `G0${GGG.HexNorm1}FE`)
      expect( token ).toEqual( {
        col: 1,
        code: "G",
        len: 5,
        data: [1,14/15],
      })
    })

    test(`encoding: HexList1 (0${GGG.HexList1})`, () => {
      const [ token, remain ] = gggParseArgument( `G0${GGG.HexList1}AB` )
      expect( token ).toEqual( {
        col: 1,
        code: "G",
        len: 5,
        data: [10,11],
      })
    })

    test("encoding: One (K)", () => {
      const [ token, remain ] = gggParseArgument( `ok` )
      expect( token ).toEqual( {
        col: 1,
        code: "O",
        len: 2,
        data: [1],
      })
    })
  })

  describe("keepEncoding = true", () => {
    test("Quoted string", () => {
      const [ token, remain ] = gggParseArgument( `G"Hello \\"World!\\""`, true )
      expect( token ).toEqual( {
        col: 1,
        code: "G",
        len: 19,
        data: [ { value: "Hello \"World!\"", encoding: "\"" } ],
      })
    })

    test(`encoding: HexList2 (0${GGG.HexList2})`, () => {
      const [ token, remain ] = gggParseArgument( `G0${GGG.HexList2}FFF0`, true )
      expect( token ).toEqual( {
        col: 1,
        code: "G",
        len: 7,
        data: [
          { value: 255, encoding: GGG.HexList2 },
          { value: 240, encoding: GGG.HexList2 },
        ],
      })
    })
  })
} )
