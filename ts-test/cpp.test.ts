import { describe, test, expect } from "@jest/globals"
import { testCppMachine } from "./test-utils"
import gggParseLines from "../ts/ggg/gggParseLines"

describe("cpp", () => {
  test("cpp", async () => {
    const result = await testCppMachine(`T10\n`)
    
    const lines = gggParseLines( result )
    console.log( lines )
  })
})
