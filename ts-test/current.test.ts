import ggggxBuffer from "../ts/ggggx/ggggxBuffer"
import { GGG } from "../ts/ggg/gggLang"
import { ggggxCodes, ggggxEvents } from "../ts/ggggx/ggggxLang"
import gggFormat from "../ts/ggg/gggFormat"
import { RegionsAdd } from "../ts/ggggx/ggggxRegions"
import ggggxSample from "../ts/ggggx/ggggxSample"
import { writeDocsFiles } from "./test-utils"
import gggMachine from "../ts/ggg/gggMachine"
import ggggxCommands from "../ts/ggggx/ggggxCommands"


describe("ggggxBuffer", () => {
  describe("Norm8", () => {
    test("initialize", () => {
      const buffer = new ggggxBuffer( "UNorm8" )
      buffer.resize( [4,3,2,1] )
      expect( buffer.data ).toEqual( new Uint8Array(24) )
    })

  })

  describe("UNorm8", () => {
    test("initialize", () => {
      const buffer = new ggggxBuffer( "UNorm8" )
      buffer.resize( [4,3,2,1] )
      expect( buffer.data ).toEqual( new Uint8Array(24) )
    })
    test("write", () => {
      const buffer = new ggggxBuffer( "UNorm8" )
      buffer.resize( [3] )
      buffer.write( [1] )
      expect( buffer.data ).toEqual( Uint8Array.from( [255,0,0] ) )
      expect( buffer.read() ).toEqual( 1 )
    })
  })

})

