import { describe, test, expect } from "@jest/globals"
import Matrix from "../ts/ggg/Matrix"
import { Blit, buildTransform, applyHomogeneous } from "../ts/ggggx/Blit"

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
    Blit( d, mk( [ 3, 3 ], srcData ), { mode: "box", matrix: [ 0, 1.5, 0, 1.5 ], combine: [ "nearest" ] } )
    expect( d.data ).toEqual( [ 1, 1, 2, 1, 1, 2, 4, 4, 5 ] )
  } )

  test( "box sub-region [1,3] selects + stretches source columns 1..3 (nearest)", () => {
    const d = mk( [ 3, 3 ] )
    Blit( d, mk( [ 3, 3 ], srcData ), { mode: "box", matrix: [ 1, 3, 0, 3 ], combine: [ "nearest" ] } )
    expect( d.data ).toEqual( [ 2, 2, 3, 5, 5, 6, 8, 8, 9 ] )
  } )

  test( "map points each dest axis at a source axis (srcAxis,min,max) -- generalizes box", () => {
    // dest0<-src0 full, dest1<-src1 [1,3]  ==  box [0,3,1,3]
    const a = mk( [ 3, 3 ] )
    Blit( a, mk( [ 3, 3 ], srcData ), { mode: "map", matrix: [ 0, 0, 3, 1, 1, 3 ], combine: [ "nearest" ] } )
    expect( a.data ).toEqual( [ 4, 5, 6, 4, 5, 6, 7, 8, 9 ] )
  } )

  test( "map swaps axes -> transpose, and swap+reverse -> a quarter-turn rotation", () => {
    const t = mk( [ 3, 3 ] )           // dest0<-src1, dest1<-src0 = transpose
    Blit( t, mk( [ 3, 3 ], srcData ), { mode: "map", matrix: [ 1, 0, 3, 0, 0, 3 ], combine: [ "nearest" ] } )
    expect( t.data ).toEqual( [ 1, 4, 7, 2, 5, 8, 3, 6, 9 ] )
    const r = mk( [ 3, 3 ] )           // dest0<-src1 reversed, dest1<-src0 = 90 deg CW
    Blit( r, mk( [ 3, 3 ], srcData ), { mode: "map", matrix: [ 1, 2.5, -0.5, 0, 0, 3 ], combine: [ "nearest" ] } )
    expect( r.data ).toEqual( [ 7, 4, 1, 8, 5, 2, 9, 6, 3 ] )
  } )

  test( "axis-0 shifted box (nearest, hold) shifts along the innermost axis", () => {
    const d = mk( [ 3, 3 ] )
    // box [1.2,4.2] on axis 0 == old scale 1 + translate 0.4 (1.2/3); held at edge.
    Blit( d, mk( [ 3, 3 ], srcData ), { mode: "box", matrix: [ 1.2, 4.2, 0, 3 ], combine: [ "nearest" ], edges: [ "hold" ] } )
    expect( d.data ).toEqual( [ 2, 3, 3, 5, 6, 6, 8, 9, 9 ] )
  } )

  test( "per-axis combine: linear on X, nearest on Y (F0,1) -- smooth columns, stepped rows", () => {
    const d = mk( [ 3, 3 ] )
    Blit( d, mk( [ 3, 3 ], srcData ), { mode: "box", matrix: [ 0, 1.5, 0, 1.5 ], combine: [ "linear", "nearest" ] } )
    expect( d.data ).toEqual( [ 1, 1.5, 2, 1, 1.5, 2, 4, 4.5, 5 ] )
  } )

  test( "minify: linear box-means the footprint (anti-aliases) on a 2x oversized box", () => {
    const d = mk( [ 3, 3 ] )
    Blit( d, mk( [ 3, 3 ], srcData ), { mode: "box", matrix: [ 0, 6, 0, 6 ], edges: [ "hold" ] } )
    expect( d.data ).toEqual( [ 1, 2.75, 3, 5.5, 7.25, 7.5, 7, 8.75, 9 ] )
  } )

  test( "minify: separable per-axis pool F3,0 -- max-pool X, mean-pool Y", () => {
    const d = mk( [ 3, 3 ] )
    Blit( d, mk( [ 3, 3 ], srcData ), { mode: "box", matrix: [ 0, 6, 0, 6 ], combine: [ "max", "linear" ], edges: [ "hold" ] } )
    expect( d.data ).toEqual( [ 1, 3, 3, 5.5, 7.5, 7.5, 7, 9, 9 ] )
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
