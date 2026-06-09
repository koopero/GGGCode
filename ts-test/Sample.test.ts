import { describe, test, expect } from "@jest/globals"
import Sample from "../ts/ggggx/Sample"
import Matrix from "../ts/ggg/Matrix"

describe( "Sample", () => {
  // 1-D buffer [10,20,30] (normalized coords; val = pos * size).
  const line = new Matrix( { dim: [ 3 ], data: [ 10, 20, 30 ] } )

  test( "filter linear interpolates the point", () => {
    expect( Sample( line, [ 0 ],   { filter: [ "linear" ] } ) ).toEqual( [ 10 ] )
    expect( Sample( line, [ 0.5 ], { filter: [ "linear" ] } ) ).toEqual( [ 25 ] )  // lerp px1,px2
  } )

  test( "filter nearest picks the nearest texel", () => {
    expect( Sample( line, [ 0.5 ], { filter: [ "nearest" ] } ) ).toEqual( [ 20 ] )
    expect( Sample( line, [ 0 ],   { filter: [ "nearest" ] } ) ).toEqual( [ 10 ] )
  } )

  test( "fold reduces the footprint when minifying (footprint [3] covers the whole axis)", () => {
    const fp = { footprint: [ 3 ] }
    expect( Sample( line, [ 0.5 ], { filter: [ "max" ],  ...fp } ) ).toEqual( [ 30 ] )
    expect( Sample( line, [ 0.5 ], { filter: [ "min" ],  ...fp } ) ).toEqual( [ 10 ] )
    expect( Sample( line, [ 0.5 ], { filter: [ "add" ],  ...fp } ) ).toEqual( [ 60 ] )
    expect( Sample( line, [ 0.5 ], { filter: [ "mean" ], ...fp } ) ).toEqual( [ 20 ] )
    // no fold (default) => the filter just samples the centre, footprint ignored
    expect( Sample( line, [ 0.5 ], { filter: [ "nearest" ], ...fp } ) ).toEqual( [ 20 ] )
  } )

  // 3 channels x 3 pixels: px0=red, px1=green, px2=blue.
  const rgb = new Matrix( { dim: [ 3, 3 ], data: [ 1, 0, 0,  0, 1, 0,  0, 0, 1 ] } )

  test( "multi-channel linear interpolation along the spatial axis", () => {
    const o = { dimension: 1, filter: [ "linear" ] }
    expect( Sample( rgb, [ 0, 0 ],     o ) ).toEqual( [ 1, 0, 0 ] )
    expect( Sample( rgb, [ 0, 1 / 6 ], o ) ).toEqual( [ 0.5, 0.5, 0 ] )  // half px0->px1
    expect( Sample( rgb, [ 0, 1 / 3 ], o ) ).toEqual( [ 0, 1, 0 ] )
  } )

  test( "per-axis filter: linear on axis 0, nearest on axis 1", () => {
    // 3x3 = 1..9 (x inner, y outer). At (0.5, 0.5): x lerps px1,px2; y nearest.
    const grid = new Matrix( { dim: [ 3, 3 ], data: [ 1, 2, 3, 4, 5, 6, 7, 8, 9 ] } )
    expect( Sample( grid, [ 0.5, 0.5 ], { filter: [ "linear", "nearest" ] } ) ).toEqual( [ 5.5 ] )
  } )
} )
