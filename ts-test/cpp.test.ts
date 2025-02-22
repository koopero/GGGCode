import { describe, test, expect } from "@jest/globals"
import { testCxxMachine } from "./test-utils"
import ParseLines from "../ts/ggg/ParseLines"
import Format from "../ts/ggg/Format"
import { PrintNumbersName, PrintPrefix, PrintResponseName } from "../ts/gggpx/PrintDefs"
import { GGG } from "../ts/ggg/gggLang"

describe("cpp", () => {
  test("mvp", async () => {
    const command = PrintNumbersName
    const response = PrintResponseName
    const data = [ 10, 20, 30 ]
    const dataEncoded = data.map( x => "0x"+x.toString(16) ).join(",")
    const argCode = "A"
    const result = await testCxxMachine(`${command} ${argCode}${dataEncoded}\n`)
    const lines = ParseLines( result )
    expect( lines.length ).toBe( 2 )
    const printLine = lines[0]

    expect( printLine ).toMatchObject( {
      command: response,
      args: [
        {
          code: argCode,
          data,
        }
      ]
    })

    const okayLine = lines[1]
    expect( okayLine ).toMatchObject( {
      command: "O1",
    })
  })

  describe("PrintCommand", () => {

  //   test(`arg Command (${GGG.Command})`, async () => {
  //     const data = [ 10, 20, 30 ]
  //     const responseIndex = 11
  //     const responseCommand = `${PrintPrefix}${responseIndex}`
  //     const result = await testCxxMachine(`${PrintNumbersName} ${GGG.Command}${responseIndex} ${GGG.Data}${data}\n`)
  //     const lines = ParseLines( result )
  //     expect( lines.length ).toBe( 2 )
  //     const printLine = lines[0]
  //     expect( printLine ).toMatchObject( {
  //       command: responseCommand,
  //       args: [
  //         {
  //           code: GGG.Data,
  //           data,
  //         }
  //       ]
  //     })
  //   })
  // })
  
  // describe("Encoding", () => {
  //   function testEncoding( name:string, str:string, expected:number[] ) {
  //     test( name, async () => {
  //       const result = await testCxxMachine(`${PrintNumbersName} ${GGG.Data}${str}\n`)
  //       const lines = ParseLines( result )
  //       expect( lines.length ).toBe( 2 )
  //       const printLine = lines[0]
  //       expect( printLine ).toMatchObject( {
  //         command: PrintResponseName,
  //         args: [
  //           {
  //             code: GGG.Data,
  //             data: expected,
  //           }
  //         ]
  //       })
  //     })
  //   }

  //   testEncoding("single", "1", [1])
  //   testEncoding("double", "1,2", [1,2])
  //   testEncoding("hex", "0x10,0x20", [16,32])
  //   testEncoding("EncodedOne", GGG.EncodedOne, [1])
  //   testEncoding("EncodedZero", GGG.EncodedZero, [0])
  //   testEncoding("EncodedMinusOne", GGG.EncodedMinusOne, [-1])
  //   testEncoding("HexList2", `0${GGG.HexList2}a0b0`, [160,176])
  })
})
