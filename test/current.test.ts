import Matrix from "../src/ggggx/Matrix"
import { GGG } from "../src/ggg/gggLang"
import { ggggxCodes, ggggxEvents } from "../src/ggggx/ggggxLang"
import Format from "../src/ggg/Format"
import { RegionsAdd } from "../src/ggggx/Regions"
import Sample from "../src/ggggx/Sample"
import { writeDocsFiles } from "./test-utils"
import gggMachine from "../src/ggg/gggMachine"
import ggggxCommands from "../src/ggggx/ggggxCommands"
import { DimSize } from "../src/ggggx/Dim"


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

