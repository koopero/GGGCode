import ParseData from "../ts/ggg/ParseData"
import { Solve } from "../ts/ggg/Solve"
import { UnitaryNames, UnitaryValues } from "../ts/ggg/Language"


const funUnicodeChars: string[] =  [...`⚡🚀🐉🎩🦄🀄🎶🔱🔮` ]
function getRandomUnicodeChar(): string {
  return funUnicodeChars[Math.floor(Math.random() * funUnicodeChars.length)];
}


describe("ts:unicode", () => {
  describe("ParseData", () => {
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
  
  // describe("Solve", () => {
  //   test("unicode math?!", () => {
  //     const char1 = getRandomUnicodeChar()
  //     const char2 = getRandomUnicodeChar()
  //     const point1 = char1.codePointAt(0) || 0
  //     const point2 = char2.codePointAt(0) || 0
  //     const str = `${char1}|${char2}`
  //     const result = [ ...Solve(str, { solveStrings: true }) ]
  //     expect(result).toEqual([point1 + point2])
  //   })
  // })
})