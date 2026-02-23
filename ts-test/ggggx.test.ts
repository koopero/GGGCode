import { describe, expect, test, jest } from '@jest/globals'
import Matrix from "../ts/ggg/Matrix"
import { GGG } from "../ts/ggg/Language"
import { GXCommandNames, MatrixEvents } from "../ts/ggggx/GXLanguage"
import Format from "../ts/ggg/Format"
import { RegionsAdd } from "../ts/ggggx/Regions"
import { writeDocsFiles } from "./test-utils"
import Machine from "../ts/ggg/Machine"
import { GXCommands } from "../ts/ggggx/GXCommands"
import { MatrixReadCode } from "../ts/ggggx/MatrixRead"
import { OpIndexes, Ops } from '../ts/ggggx/Operators'

function ggggxMachine() {
  const machine = new Machine( { commands: GXCommands } )
  return machine 
}


describe("Matrix", () => {
  test("will initialize", () => {
    const buffer = new Matrix()
    expect( buffer ).toBeDefined()
    expect( buffer ).toBeInstanceOf( Matrix )
    const { dim, data } = buffer
    expect( dim ).toEqual( [] )
    expect( data ).toEqual( [] )
  })

  describe("resize", () => {
    test("simple", () => {
      const buffer = new Matrix()
      buffer.resize( [4,3,2,1] )
      const { dim, data } = buffer
      expect( dim ).toEqual( [4,3,2] )
      expect( data.length ).toEqual( 24 )
    })

    test("preserve data", () => {
      const buffer = new Matrix( { 
        dim: [2],
        data: [0,1],
      })

      expect( buffer.data ).toEqual( [0,1] )
      buffer.resize( [2,2] )
      expect( buffer.data ).toEqual( [0,1,0,0] )
    })

    // test("emits event", () => {

    //   const buffer = new Matrix( { dim: [1,1,2] } )
    //   const onResize = jest.fn()
    //   buffer.on( MatrixEvents.Resize, onResize )
    //   buffer.resize( [1,2,2] )
    //   buffer.resize( [1,2,2] )
    //   expect( onResize ).toHaveBeenCalledTimes( 1 )
    // })
  })

  test("write", () => {
    const buffer = new Matrix()
    buffer.resize( [4,3,2,1] )
    buffer.write( [1,2,3,4] )
    expect( buffer.data[3] ).toEqual( 4 )
  })

  test("read", () => {
    const buffer = new Matrix()
    buffer.resize( 4 )
    buffer.write( [1,2,3,4] )
    expect( buffer.read( 2, 0 ) ).toEqual( 3 )
    expect( buffer.read( 2, [0,0] ) ).toEqual( [3,4] )
    expect( buffer.read( 2, { r:0,g:0} ) ).toEqual( {r:3,g:4} )
  })


  describe("UNorm8", () => {
    test("initialize", () => {
      const buffer = new Matrix( "UNorm8" )
      buffer.resize( [4,3,2,1] )
      expect( buffer.data ).toEqual( new Uint8Array(24) )
    })
    test("write", () => {
      const buffer = new Matrix( "UNorm8" )
      buffer.resize( [3] )
      buffer.write( [1] )
      expect( buffer.data ).toEqual( Uint8Array.from( [255,0,0] ) )
      expect( buffer.read() ).toEqual( 1 )
    })
  })

  describe("events", () => {
    describe(MatrixEvents.RegionChange, () => {
      test("will emit", () => {
        const buffer = new Matrix( {
          dim: [2,2]
        })

        const onRegion = jest.fn()

        buffer.on( MatrixEvents.RegionChange, onRegion )

        buffer.write( [1,1], [0,1] )

        expect( onRegion ).toHaveBeenCalledTimes( 1 )
        expect( onRegion ).toHaveBeenCalledWith( [2,4] )
      })
    })
  })
})




const TestBufferIndexToken = `${GGG.Register}1`


const RunTestBuffer = `
  ${GXCommandNames.MatrixInit} ${TestBufferIndexToken} D2,2,2,2 N"Test" 
  ${GXCommandNames.MatrixWrite} ${TestBufferIndexToken} V0.25,0.5
`


// describe(`command: ${GXCommandNames.MatrixRead}`, () => {
//   test("will dump", async () => {
//     const machine = ggggxMachine()
//     await machine.run( `
//       ${RunTestBuffer}
//     `)

//     const result = await machine.run( `
//       ${GXCommandNames.MatrixRead} ${TestBufferIndexToken}
//     `)

//     const secondMachine = ggggxMachine()
//     await secondMachine.run( result )

//   })
// })

describe(GXCommandNames.MatrixWatch, () => {
  // test("will watch", async () => { 
  //   const machine = ggggxMachine()
  //   await machine.run( `
  //     ${RunTestBuffer}
  //   `)

  //   let result = await machine.run( `
  //     ${ggggxCodes.WatchBuffers} ${TestBufferIndexToken}
  //   `)

  //   // engine.buffers.get(1).write( [0.25,1] )


  //   result = await machine.run( `
  //     ${ggggxCodes.WatchBuffers} E8 ${TestBufferIndexToken}
  //   `)

  //   expect( Format( result ) ).toEqual( `G1 ${TestBufferIndexToken} O1 V0Hff\nOK\n` )

  // })
})

