import { GGG, RangeAxis } from "../ts/ggg/Language"
import Format, { FormatData } from "../ts/ggg/Format"


describe("Format", () => {
  test("code + data", () => {
    expect( Format( { code: 'G', data: [ 1 ]} ) ).toBe( "G1" )
  })

  test("hex", () => {
    expect( Format( { code: 'G', data: [ 16/255 ], encoding: GGG.HexNorm2 } ) ).toBe( `G0${GGG.HexNorm2}10` )
  })

  test("line", () => {
    expect( Format( { command: "G4", args: [ { code: 'X', data: [ 1 ]} ] } ) ).toBe( "G4 X1" )
  })

  test("okay", () => {
    expect( Format( { code: "O", encoding: GGG.EncodedOne, data: 1 } ) ).toBe( "OK" )
  })

})

describe("FormatData", () => {
  describe("RangeAxis", () => {
    test("everything", () => {
      const start = 10
      const end = 30
      const step = 4
      const multiplier = 3
      const inclusive = true

      const data = { start, end, step, multiplier, inclusive } as RangeAxis
      const str = `${start}${GGG.Range}${end}${GGG.Range}${step}${GGG.Multiplier}${multiplier}`
      expect( FormatData( data ) ).toBe( str )
    })
  })
})