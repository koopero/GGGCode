import { describe, test, expect } from "@jest/globals"
import Matrix from "../ts/ggg/Matrix"
import { Blit, buildTransform, applyHomogeneous } from "../ts/ggggx/Blit"
import { SampleReduce } from "../ts/ggggx/Sample"

function mk( dim: number[], data?: number[] ) {
  return new Matrix( { dim, data: data ?? new Array( dim.reduce( ( a, b ) => a * b, 1 ) ).fill( 0 ) } )
}

describe( "Blit", () => {
  // source 3x3 = 1..9
  const srcData = [ 1, 2, 3, 4, 5, 6, 7, 8, 9 ]

  test( "an unknown mode falls back to an identity copy (no separate identity mode)", () => {
    const d = mk( [ 3, 3 ] )
    Blit( d, mk( [ 3, 3 ], srcData ), { mode: "identity" } )   // "identity" is no longer a mode
    expect( d.data ).toEqual( srcData )
  } )

  test( "affine identity copies the source", () => {
    const d = mk( [ 3, 3 ] )
    Blit( d, mk( [ 3, 3 ], srcData ), { mode: "affine", matrix: [ 1, 0, 0, 0, 1, 0 ] } )
    expect( d.data ).toEqual( srcData )
  } )

  test( "default (no mode) is a box of the full source -- identity copy", () => {
    const d = mk( [ 3, 3 ] )
    Blit( d, mk( [ 3, 3 ], srcData ), {} )
    expect( d.data ).toEqual( srcData )
  } )

  test( "explicit full-source box [0,dim] copies the source", () => {
    const d = mk( [ 3, 3 ] )
    Blit( d, mk( [ 3, 3 ], srcData ), { mode: "box", matrix: [ 0, 3, 0, 3 ] } )
    expect( d.data ).toEqual( srcData )
  } )

  test( "mode by index (0 = box) with a default box copies the source", () => {
    const d = mk( [ 3, 3 ] )
    Blit( d, mk( [ 3, 3 ], srcData ), { mode: 0 } )
    expect( d.data ).toEqual( srcData )
  } )

  test( "half-extent box [0,1.5] nearest magnifies the top-left", () => {
    const d = mk( [ 3, 3 ] )
    Blit( d, mk( [ 3, 3 ], srcData ), { mode: "box", matrix: [ 0, 1.5, 0, 1.5 ], filter: "nearest" } )
    expect( d.data ).toEqual( [ 1, 1, 2, 1, 1, 2, 4, 4, 5 ] )
  } )

  test( "box sub-region [1,3] selects + stretches source columns 1..3 (nearest)", () => {
    const d = mk( [ 3, 3 ] )
    Blit( d, mk( [ 3, 3 ], srcData ), { mode: "box", matrix: [ 1, 3, 0, 3 ], filter: "nearest" } )
    expect( d.data ).toEqual( [ 2, 2, 3, 5, 5, 6, 8, 8, 9 ] )
  } )

  test( "map remaps a single named axis (axis,min,max), leaving the rest identity", () => {
    // map (axis 0, 1, 3) == box [1,3,0,3]; map (axis 1, 1, 3) remaps the outer axis.
    const a = mk( [ 3, 3 ] )
    Blit( a, mk( [ 3, 3 ], srcData ), { mode: "map", matrix: [ 0, 1, 3 ], filter: "nearest" } )
    expect( a.data ).toEqual( [ 2, 2, 3, 5, 5, 6, 8, 8, 9 ] )
    const b = mk( [ 3, 3 ] )
    Blit( b, mk( [ 3, 3 ], srcData ), { mode: "map", matrix: [ 1, 1, 3 ], filter: "nearest" } )
    expect( b.data ).toEqual( [ 4, 5, 6, 4, 5, 6, 7, 8, 9 ] )
  } )

  test( "axis-0 shifted box (nearest, hold) shifts along the innermost axis", () => {
    const d = mk( [ 3, 3 ] )
    // box [1.2,4.2] on axis 0 == old scale 1 + translate 0.4 (1.2/3); held at edge.
    Blit( d, mk( [ 3, 3 ], srcData ), { mode: "box", matrix: [ 1.2, 4.2, 0, 3 ], filter: "nearest", edge: "hold" } )
    expect( d.data ).toEqual( [ 2, 3, 3, 5, 6, 6, 8, 9, 9 ] )
  } )

  test( "oversized box [0,6] + mid reduce minifies (mean over a 2-texel footprint)", () => {
    const d = mk( [ 3, 3 ] )
    Blit( d, mk( [ 3, 3 ], srcData ), { mode: "box", matrix: [ 0, 6, 0, 6 ], edge: "hold", reduce: "mid" } )
    expect( d.data.map( ( v: number ) => +v.toFixed( 4 ) ) )
      .toEqual( [ 2.1875, 3.5625, 3.75, 6.6875, 8.0625, 8.25, 7.25, 8.75, 9 ] )
  } )

  describe( "SampleReduce", () => {
    // taps cover the whole image (footprint [3,3], nearest) -> the 9 cells exactly.
    const src = mk( [ 3, 3 ], srcData )
    const opt = { dimension: 0, filter: "nearest", edge: "repeat", coord: "normalized" }
    test( "add sums the footprint", () => {
      expect( SampleReduce( src, [ 0.5, 0.5 ], [ 3, 3 ], "add", opt ) ).toEqual( [ 45 ] )
    } )
    test( "mid is the arithmetic mean", () => {
      expect( SampleReduce( src, [ 0.5, 0.5 ], [ 3, 3 ], "mid", opt ) ).toEqual( [ 5 ] )
    } )
    test( "max / min are the extrema", () => {
      expect( SampleReduce( src, [ 0.5, 0.5 ], [ 3, 3 ], "max", opt ) ).toEqual( [ 9 ] )
      expect( SampleReduce( src, [ 0.5, 0.5 ], [ 3, 3 ], "min", opt ) ).toEqual( [ 1 ] )
    } )
    test( "footprint <= 1 degrades to a point sample", () => {
      expect( SampleReduce( src, [ 0.5, 0.5 ], [ 1, 1 ], "mid", opt ) ).toEqual( [ 5 ] )
    } )
  } )

  test( "buildTransform / applyHomogeneous: box maps the pixel rect to normalized source", () => {
    // box [2,7] x [3,8] on a 10x10 source: scale 0.5, translate 0.2 / 0.3.
    const H = buildTransform( "box", [ 2, 7, 3, 8 ], 2, [ 10, 10 ] )
    const a = applyHomogeneous( H, [ 0, 0 ], 2 )
    expect( a[0] ).toBeCloseTo( 0.2 ); expect( a[1] ).toBeCloseTo( 0.3 )
    const b = applyHomogeneous( H, [ 1, 1 ], 2 )
    expect( b[0] ).toBeCloseTo( 0.7 ); expect( b[1] ).toBeCloseTo( 0.8 )
  } )

  test( "buildTransform / applyHomogeneous: affine fills the matrix", () => {
    const H = buildTransform( "affine", [ 2, 0, 0.1, 0, 2, 0.2 ], 2 )
    const b = applyHomogeneous( H, [ 0.5, 0.5 ], 2 )
    expect( b[0] ).toBeCloseTo( 1.1 ); expect( b[1] ).toBeCloseTo( 1.2 )
  } )
} )
