import Matrix from "../ts/ggggx/Matrix"
import SavePNG from "../ts/ggggx/SavePNG"
import LoadPNG from "../ts/ggggx/LoadPNG"
import { writeToTestOutput } from "./test-utils"
import { decode, encode } from "fast-png"


describe("png", () => {
  test("example image", async () => {
    const width = 160
    const height = 120

    const buffer = new Matrix({
      dim: [ 3,width,height ],
    })

    for ( let y = 0; y < height; y++ ) {
      for ( let x = 0; x < width; x++ ) {
        // buffer.write( [ 0.5 ], [ 0, 0, 0, (y * width + x) * 3 ] )
        buffer.write( [ x/(width-1), y/(height-1), 1 ], [ x, y ] )
      }
    }

    const data = SavePNG( buffer, {} )  
    await writeToTestOutput( "example.png", data )
  })

  test("SavePNG", () => {
    const writeBuffer = new Matrix({
      dim: [ 3, 3 ],
      data: [ 1, 0, 0, 0, 1, 0, 0, 0, 1 ],
    })

    const pngData = SavePNG( writeBuffer )

    const result = decode( pngData )

    expect( result.width ).toEqual( 3 )
    expect( result.height ).toEqual( 1 )
    expect( result.data[0] ).toEqual( 255 )
    expect( result.data[1] ).toEqual( 0 )
    expect( result.data.length ).toEqual( 3 * 3 )
  })


  // test("read back", async () => {
  //   const writeBuffer = new Matrix({
  //     dim: [ 3, 3 ],
  //     data: [ 1, 0, 0, 0, 1, 0, 0, 0, 1 ],
  //   })

  //   const writeData = SavePNG( writeBuffer, {} )

  //   console.log( writeData )

  //   const result = LoadPNG( writeData, {} )


  //   expect( result.dim ).toEqual( [ 3, 3 ] )
  //   expect( result.data[0] ).toEqual( 255 )
  //   expect( result.data[1] ).toEqual( 0 )
  //   expect( result.data[4] ).toEqual( 255 )
  // })
})