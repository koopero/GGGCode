import { describe, test, expect } from "@jest/globals"
import { testCppMachine } from "./test-utils"
import gggParseLines from "../ts/ggg/gggParseLines"
import Format from "../ts/ggg/Format"
import { PrintCommandName, PrintPrefix, PrintResponseName } from "../ts/gggpx/Print"
import { GGG } from "../ts/ggg/gggLang"

describe("cpp", () => {
  describe("PrintCommand", () => {
    test("cpp", async () => {
      const command = PrintCommandName
      const response = PrintResponseName
      const data = [ 10, 20, 30 ]
      const dataEncoded = data.map( x => "0x"+x.toString(16) ).join(",")
      const argCode = "A"
      const result = await testCppMachine(`${command} ${argCode}${dataEncoded}\n`)
      const lines = gggParseLines( result )
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

    test(`arg Command (${GGG.Command})`, async () => {
      const data = [ 10, 20, 30 ]
      const responseIndex = 11
      const responseCommand = `${PrintPrefix}${responseIndex}`
      const result = await testCppMachine(`${PrintCommandName} ${GGG.Command}${responseIndex} ${GGG.Data}${data}\n`)
      const lines = gggParseLines( result )
      expect( lines.length ).toBe( 2 )
      const printLine = lines[0]
      expect( printLine ).toMatchObject( {
        command: responseCommand,
        args: [
          {
            code: GGG.Data,
            data,
          }
        ]
      })
    })
  })
  
})
