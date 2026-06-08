import { describe, test, expect } from "@jest/globals"
import Matrix from "../ts/ggg/Matrix"
import { Blit, buildTransform, applyHomogeneous } from "../ts/ggggx/Blit"

function mk( dim: number[], data?: number[] ) {
  return new Matrix( { dim, data: data ?? new Array( dim.reduce( ( a, b ) => a * b, 1 ) ).fill( 0 ) } )
}

describe( "Blit", () => {
  // source 3x3 = 1..9
  const srcData = [ 1, 2, 3, 4, 5, 6, 7, 8, 9 ]

  test( "identity copies the source", () => {
    const d = mk( [ 3, 3 ] )
    Blit( d, mk( [ 3, 3 ], srcData ), { mode: "identity" } )
    expect( d.data ).toEqual( srcData )
  } )

  test( "affine identity copies the source", () => {
    const d = mk( [ 3, 3 ] )
    Blit( d, mk( [ 3, 3 ], srcData ), { mode: "affine", matrix: [ 1, 0, 0, 0, 1, 0 ] } )
    expect( d.data ).toEqual( srcData )
  } )

  test( "scale+translate identity copies the source", () => {
    const d = mk( [ 3, 3 ] )
    Blit( d, mk( [ 3, 3 ], srcData ), { mode: "scale+translate", matrix: [ 1, 1, 0, 0 ] } )
    expect( d.data ).toEqual( srcData )
  } )

  test( "mode by index (2 = scale+translate)", () => {
    const d = mk( [ 3, 3 ] )
    Blit( d, mk( [ 3, 3 ], srcData ), { mode: 2, matrix: [ 1, 1, 0, 0 ] } )
    expect( d.data ).toEqual( srcData )
  } )

  test( "scale 0.5 nearest magnifies the top-left", () => {
    const d = mk( [ 3, 3 ] )
    Blit( d, mk( [ 3, 3 ], srcData ), { mode: "scale+translate", matrix: [ 0.5, 0.5, 0, 0 ], filter: "nearest" } )
    expect( d.data ).toEqual( [ 1, 1, 2, 1, 1, 2, 4, 4, 5 ] )
  } )

  test( "translate (nearest, hold) shifts along axis 0 (innermost)", () => {
    const d = mk( [ 3, 3 ] )
    // axis 0 is the innermost (stride-1) axis; translate[0]=+0.4 normalized shifts
    // it: cell x samples src floor((x/3+0.4)*3) = x+1 (held at the edge).
    Blit( d, mk( [ 3, 3 ], srcData ), { mode: "scale+translate", matrix: [ 1, 1, 0.4, 0 ], filter: "nearest", edge: "hold" } )
    expect( d.data ).toEqual( [ 2, 3, 3, 5, 6, 6, 8, 9, 9 ] )
  } )

  test( "buildTransform / applyHomogeneous: scale+translate maps coordinates", () => {
    const H = buildTransform( "scale+translate", [ 2, 2, 0.1, 0.2 ], 2 )
    const a = applyHomogeneous( H, [ 0, 0 ], 2 )
    expect( a[0] ).toBeCloseTo( 0.1 ); expect( a[1] ).toBeCloseTo( 0.2 )
    const b = applyHomogeneous( H, [ 0.5, 0.5 ], 2 )
    expect( b[0] ).toBeCloseTo( 1.1 ); expect( b[1] ).toBeCloseTo( 1.2 )
  } )
} )
