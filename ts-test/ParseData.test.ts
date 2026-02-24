import { describe, test, expect } from "@jest/globals"
import ParseData from "../ts/ggg/ParseData"
import { GGG, UnitaryNames, UnitaryValues } from "../ts/ggg/Language"

const funUnicodeChars: string[] =  [...`⚡🚀🐉🎩🦄🀄🎶🔱🔮` ]
function getRandomUnicodeChar(): string {
  return funUnicodeChars[Math.floor(Math.random() * funUnicodeChars.length)];
}

describe("ParseData",() => {
  describe("basic", () => {
    test("will parse some data", () => {
      const str = "100"
      const result = ParseData( str )
      const [ data, remain ] = result

      expect( data ).toEqual( [ 100 ] )
      expect( remain ).toBe("")
    })

    test("will pass remaining string", () => {
      const str = "123,456 other"
      const result = ParseData( str )
      const [ data, remain ] = result

      expect( data ).toEqual( [ 123, 456 ] )
      expect( remain ).toBe(" other")
    })
  })

  describe("encoding", () => {
    test(`StringToEOL (${GGG.StringToEOL})`, () => {
      const str = `${GGG.StringToEOL}foo bar foo\nbaz`
      const [ data, remain ] = ParseData( str )
      expect( data ).toEqual( [ "foo bar foo" ])
      expect( remain ).toBe("\nbaz")
    })
  })

  describe("references", () => {
    test("simple reference", () => {
      const str = "$test[1,2,3]"
      const [ data, remain ] = ParseData( str )
      expect( data ).toMatchObject( [ {
        register: "test",
        subscript: [ 1, 2, 3 ]
      } ] )
    })
  })

  describe("ranges", () => {
    test("default range", () => {
      const str = "10:30:4:3"
      const [ data, remain ] = ParseData( str )
      expect( data ).toMatchObject( [ {
        start: 10,
        end: 30,
        inclusive: true,
        step: 4,
        multiplier: 3,
      } ] )
    })

    test("multi axis", () => {
      const str = "Z>10|0x14:30|40:50"
      const [ data, remain ] = ParseData( str )
      expect( data ).toMatchObject( [ {
        axes: [
          { start: 0, end: 10, inclusive: false },
          { start: 20, end: 30, inclusive: true },
          { start: 40, end: 50, inclusive: true },
        ]
      } ] )
    })
  })

    describe("Unicode parsing", () => {
    test("higher code points interpreted as numbers", () => {
      const str = getRandomUnicodeChar()
      const codePoint = str.codePointAt(0) || 0
      expect( ParseData(str) ).toEqual([[codePoint], ""])
    })

    test("multiple unicode char", () => {
      const chr = getRandomUnicodeChar()
      const codePoint1 = chr.codePointAt(0) || 0
      const codePoint2 = 0x1f4a9
      const str = `${chr}💩`
      expect( ParseData(str) ).toEqual([[codePoint1, codePoint2], ""])
    })

    test("mix with default data", () => {
      const codePoint1 = 0x1f4a9
      const value = 123.4
      const codePoint2 = 0x1f4a9
      const str = `💩${value}💩`
      expect( ParseData(str) ).toEqual([[codePoint1, value, codePoint2], ""])
    })
  })

  describe("unitary unicode constants", () => {
    const unicodeUnitaries = [
      UnitaryNames.Pi,
      UnitaryNames.TwoPi,
      UnitaryNames.GoldenRatio,
      UnitaryNames.EulerMascheroni,
    ]

    test.each( unicodeUnitaries )(
      "%s resolves to its value, not its codepoint",
      ( name ) => {
        const value = UnitaryValues[ name ]
        const codePoint = name.codePointAt(0)!
        const [ data ] = ParseData( name )
        expect( data ).toEqual( [value] )
        expect( data ).not.toEqual( [codePoint] )
      }
    )

    test("unitary unicode mixed with non-unitary unicode", () => {
      const nonUnitary = "💩"
      const codePoint = nonUnitary.codePointAt(0)!
      const [ data ] = ParseData( `${nonUnitary}π${nonUnitary}` )
      expect( data ).toEqual( [codePoint, Math.PI, codePoint] )
    })

    test("unitary unicode mixed with numbers", () => {
      const [ data ] = ParseData( `3π2` )
      expect( data ).toEqual( [3, Math.PI, 2] )
    })

    test("sequence of unitary unicode constants", () => {
      const [ data ] = ParseData( `πτφ` )
      expect( data ).toEqual( [
        UnitaryValues[UnitaryNames.Pi],
        UnitaryValues[UnitaryNames.TwoPi],
        UnitaryValues[UnitaryNames.GoldenRatio],
      ])
    })
  })
})