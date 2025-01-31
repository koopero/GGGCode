import Sample from "../ts/ggggx/Sample"
import Matrix from "../ts/ggggx/Matrix"

describe("Sample", () => {
  test("linear fence", async () => {
    const data = [ 0, 1, 2, 3 ]
    const buffer = new Matrix( {
      dim: [2,2]
    })
    buffer.write( data )
    
    const options = {
      filter: "linear",
      coord: "fence"
    }

    const pos = [ 0, 0.25 ]
    const result = Sample( buffer, pos, options )
    expect( result ).toEqual( [ 0.5, 1.5 ] )
  })

  test("rgb linear wheel", () => {
    const data = [ 
      1, 0, 0, 
      0, 1, 0,
      0, 0, 1,
    ]
    const buffer = new Matrix( {
      dim: [3,3]
    })
    buffer.write( data )
    
    const options = {
      dimension: 1,
      filter: "linear",
      coord: "pixel",
    }

    expect( Sample( buffer, [ 0, 0 ], options ) ).toEqual( [ 1, 0, 0 ] )
    expect( Sample( buffer, [ 0, 0.5 ], options ) ).toEqual( [ 0.5, 0.5, 0 ] )
    expect( Sample( buffer, [ 0, 1 ], options ) ).toEqual( [ 0, 1, 0 ] )
    expect( Sample( buffer, [ 0, 2 ], options ) ).toEqual( [ 0, 0, 1 ] )
    expect( Sample( buffer, [ 0, 2.5 ], options ) ).toEqual( [ 0.5, 0, 0.5 ] )
    expect( Sample( buffer, [ 0, 3 ], options ) ).toEqual( [ 1, 0, 0 ] )
    expect( Sample( buffer, [ 0, -1 ], options ) ).toEqual( [ 0, 0, 1 ] )
  })

  test("multi-dimensional", () => {
    const data = [
      0, 0, 0, 0, 0, 0,
      0, 0, 0, 1, 1, 1,
    ]
    const buffer = new Matrix( {
      dim: [3,2,2],
      data
    })

    const options = {
      dimension: 1,
      filter: "linear",
      coord: "pixel",
    }

    expect( Sample( buffer, [ 0 ], options ) ).toEqual( [ 0, 0, 0 ] )
    expect( Sample( buffer, [ 0,1,1 ], options ) ).toEqual( [ 1, 1, 1 ] )

  })
})

