import { describe, test, expect } from "@jest/globals"
import ParseData from "../ts/ggg/ParseData"
import { GGG } from "../ts/ggg/Language"

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
})