import { describe, test, expect } from "@jest/globals"
import { GGG, UnitaryNames, UnitaryValues, HexEncodings } from "../ts/ggg/Language"
import { ParseArg } from "../ts/index"


describe("ParseArg", () => {
  describe("keepEncoding = false", () => {
    test("Quoted string", () => {
      const [ token, remain ] = ParseArg( `G"Hello \\"World!\\""`)
      expect( token ).toEqual( {
        col: 1,
        code: "G",
        len: 19,
        data: [ "Hello \"World!\"" ],
      })
    })

    test(`encoding: HexNorm2 (0${HexEncodings.HexNorm2})`, () => {
      const [ token, remain ] = ParseArg( `G0${HexEncodings.HexNorm2}FFF0`)
      expect( token ).toEqual( {
        col: 1,
        code: "G",
        len: 7,
        data: [1,240/255],
      })
    })

    test(`encoding: HexList2 (0${HexEncodings.HexList2})`, () => {
      const [ token, remain ] = ParseArg( `G0${HexEncodings.HexList2}FFF0`)
      expect( token ).toEqual( {
        col: 1,
        code: "G",
        len: 7,
        data: [255,240],
      })
    })


    test(`encoding: HexNorm1 (0${HexEncodings.HexNorm1})`, () => {
      const [ token, remain ] = ParseArg( `G0${HexEncodings.HexNorm1}FE`)
      expect( token ).toEqual( {
        col: 1,
        code: "G",
        len: 5,
        data: [1,14/15],
      })
    })

    test(`encoding: HexList1 (0${HexEncodings.HexList1})`, () => {
      const [ token, remain ] = ParseArg( `G0${HexEncodings.HexList1}AB` )
      expect( token ).toEqual( {
        col: 1,
        code: "G",
        len: 5,
        data: [10,11],
      })
    })

    test("encoding: One (K)", () => {
      const [ token, remain ] = ParseArg( `ok` )
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
      const [ token, remain ] = ParseArg( `G"Hello \\"World!\\""`, { keepEncoding: true } )
      expect( token ).toEqual( {
        col: 1,
        code: "G",
        len: 19,
        data: [ { value: "Hello \"World!\"", encoding: "\"" } ],
      })
    })

    test(`encoding: HexList2 (0${HexEncodings.HexList2})`, () => {
      const [ token, remain ] = ParseArg( `G0${HexEncodings.HexList2}FFF0`, { keepEncoding: true } )
      expect( token ).toEqual( {
        col: 1,
        code: "G",
        len: 7,
        data: [
          { value: 255, encoding: HexEncodings.HexList2 },
          { value: 240, encoding: HexEncodings.HexList2 },
        ],
      })
    })

    test("encoding: One (K)", () => {
      const [ token, remain ] = ParseArg( `ok`, { keepEncoding: true } )
      expect( token ).toEqual( {
        col: 1,
        code: "O",
        len: 2,
        data: [ { value: 1, encoding: "K" } ],
      })
    })

    test("encoding: Pi (π) — all unitary constants use EncodedOne encoding", () => {
      const [ token ] = ParseArg( `Gπ`, { keepEncoding: true } )
      expect( token?.data ).toEqual( [ { value: Math.PI, encoding: GGG.EncodedOne } ] )
    })
  })

  describe("formulas", () => {
    test("multi-axis reference", () => {
      const [ token, remain ] = ParseArg( `R$foo[0:10|100:200]` )
      expect( token ).toMatchObject( {
        code: "R",
        data: [ { 
          register: "foo", 
          subscript: [ { 
            axes: [ { start: 0, end: 10 }, { start: 100, end: 200 } ] 
          } ]
        } ],
      })
    })

    test("multi-axis reference, multiple", () => {
      const [ token, remain ] = ParseArg( `R$foo[0:10|100:200,20:30|300:400]` )
      expect( token ).toMatchObject( {
        code: "R",
        data: [ { 
          register: "foo", 
          subscript: [ 
            { 
              axes: [ { start: 0, end: 10 }, { start: 100, end: 200 } ] 
            },
            {
              axes: [ { start: 20, end: 30 }, { start: 300, end: 400 } ]
            }
          ]
        } ],
      })
    })
    
    test("open range", () => {
      const [ token, remain ] = ParseArg( `R-1:` )
      expect( token ).toMatchObject( {
        code: "R",
        data: [ { start: -1, end: NaN, inclusive: true } ],
      })
    })

    test("open range with count", () => {
      const [ token, remain ] = ParseArg( `R0:/3` )
      expect( token ).toMatchObject( {
        code: "R",
        data: [ { start: 0, end: NaN, count: 3, inclusive: true } ],
      })
    })


  })

  describe("unitary constants", () => {
    test.each( Object.entries( UnitaryValues ) )(
      "%s parses to its numeric value",
      ( name, value ) => {
        const [ token ] = ParseArg( `G${name}` )
        expect( token?.data ).toEqual( [value] )
      }
    )

    test("lowercase ASCII variants (z, k, n) parse correctly", () => {
      const cases: [string, number][] = [
        ["z", UnitaryValues[UnitaryNames.Zero]],
        ["k", UnitaryValues[UnitaryNames.One]],
        ["n", UnitaryValues[UnitaryNames.MinusOne]],
      ]
      for ( const [char, expected] of cases ) {
        const [ token ] = ParseArg( `G${char}` )
        expect( token?.data ).toEqual( [expected] )
      }
    })

    test("unicode constants resolve to values, not codepoints", () => {
      const unicodeNames = [
        UnitaryNames.Pi,
        UnitaryNames.TwoPi,
        UnitaryNames.GoldenRatio,
        UnitaryNames.EulerMascheroni,
      ]
      for ( const name of unicodeNames ) {
        const codePoint = name.codePointAt(0)!
        const [ token ] = ParseArg( `G${name}` )
        expect( token?.data ).not.toEqual( [codePoint] )
        expect( token?.data ).toEqual( [UnitaryValues[name]] )
      }
    })

    test("unitary constants in a range", () => {
      const [ token ] = ParseArg( `Rπ:τ` )
      expect( token ).toMatchObject( {
        code: "R",
        data: [ { start: Math.PI, end: Math.PI * 2, inclusive: true } ],
      })
    })

    test("multiple unitary constants as data", () => {
      const [ token ] = ParseArg( `GZ,K,N,π` )
      expect( token?.data ).toEqual( [0, 1, -1, Math.PI] )
    })
  })

  describe("ranges", () => {
    test("simple range", () => {
      const [ token, remain ] = ParseArg( `R0:10` )
      expect( token ).toMatchObject( {
        col: 1,
        code: "R",
        len: 5,
        data: [ { start: 0, end: 10 } ],
      })
    })

    test("hex range", () => {
      const [ token, remain ] = ParseArg( `R0x0:0xFF` )
      expect( token ).toMatchObject( {
        col: 1,
        code: "R",
        data: [ { start: 0, end: 255 } ],
      })
    } )

    test("unitary range", () => {
      const [ token, remain ] = ParseArg( `RN:K/3` )
      expect( token ).toMatchObject( {
        code: "R",
        data: [ { start: -1, end: 1, count: 3, inclusive: true } ],
      })
    })
  })
} )
