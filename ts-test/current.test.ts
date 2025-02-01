import Matrix from "../ts/ggggx/Matrix"
import { GGG } from "../ts/ggg/gggLang"
import { ggggxCodes, ggggxEvents } from "../ts/ggggx/ggggxLang"
import Format from "../ts/ggg/Format"
import { RegionsAdd } from "../ts/ggggx/Regions"
import Sample from "../ts/ggggx/Sample"
import { writeDocsFiles } from "./test-utils"
import Machine from "../ts/ggg/Machine"
import ggggxCommands from "../ts/ggggx/ggggxCommands"
import { DimSize } from "../ts/ggggx/Dim"


describe("Matrix", () => {
  describe("Norm8", () => {
    test("initialize", () => {
      const buffer = new Matrix( "UNorm8" )
      buffer.resize( [4,3,2,1] )
      expect( buffer.data ).toEqual( new Uint8Array(24) )
    })

  })

  describe("UNorm8", () => {
    test("initialize", () => {
      const buffer = new Matrix( "UNorm8" )
      const dim = [4,3,2,1]
      const size = DimSize( dim )
      buffer.resize( dim )
      expect( buffer.data ).toEqual( new Uint8Array( size ) )
    })
    test("write", () => {
      const buffer = new Matrix( "UNorm8" )
      buffer.resize( [3] )
      buffer.write( [1] )
      expect( buffer.data ).toEqual( Uint8Array.from( [255,0,0] ) )
      expect( buffer.read() ).toEqual( 1 )
    })
  })

})

