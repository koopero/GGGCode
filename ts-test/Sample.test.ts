import { describe, test, expect } from "@jest/globals"
import Sample from "../ts/ggggx/Sample"
import Matrix from "../ts/ggg/Matrix"

describe( "Sample", () => {
  // 1-D buffer [10,20,30] (normalized coords; val = pos * size).
  const line = new Matrix( { dim: [ 3 ], data: [ 10, 20, 30 ] } )

  test( "linear interpolates (magnify)", () => {
    expect( Sample( line, [ 0 ],   { combine: [ "linear" ] } ) ).toEqual( [ 10 ] )
    expect( Sample( line, [ 0.5 ], { combine: [ "linear" ] } ) ).toEqual( [ 25 ] )  // lerp px1,px2
  } )

  test( "nearest picks the nearest texel", () => {
    expect( Sample( line, [ 0.5 ], { combine: [ "nearest" ] } ) ).toEqual( [ 20 ] )
    expect( Sample( line, [ 0 ],   { combine: [ "nearest" ] } ) ).toEqual( [ 10 ] )
  } )

  test( "min/max/add/linear fold the footprint (footprint [3] covers the whole axis)", () => {
    const fp = { footprint: [ 3 ] }
    expect( Sample( line, [ 0.5 ], { combine: [ "max" ],    ...fp } ) ).toEqual( [ 30 ] )
    expect( Sample( line, [ 0.5 ], { combine: [ "min" ],    ...fp } ) ).toEqual( [ 10 ] )
    expect( Sample( line, [ 0.5 ], { combine: [ "add" ],    ...fp } ) ).toEqual( [ 60 ] )
    expect( Sample( line, [ 0.5 ], { combine: [ "linear" ], ...fp } ) ).toEqual( [ 20 ] )  // box-mean
  } )

  // 3 channels x 3 pixels: px0=red, px1=green, px2=blue.
  const rgb = new Matrix( { dim: [ 3, 3 ], data: [ 1, 0, 0,  0, 1, 0,  0, 0, 1 ] } )

  test( "multi-channel linear interpolation along the spatial axis", () => {
    const o = { dimension: 1, combine: [ "linear" ] }
    expect( Sample( rgb, [ 0, 0 ],     o ) ).toEqual( [ 1, 0, 0 ] )
    expect( Sample( rgb, [ 0, 1 / 6 ], o ) ).toEqual( [ 0.5, 0.5, 0 ] )  // half px0->px1
    expect( Sample( rgb, [ 0, 1 / 3 ], o ) ).toEqual( [ 0, 1, 0 ] )
  } )

  test( "per-axis combine: linear on axis 0, nearest on axis 1", () => {
    // 3x3 = 1..9 (x inner, y outer). At (0.5, 0.5): x lerps px1,px2; y nearest.
    const grid = new Matrix( { dim: [ 3, 3 ], data: [ 1, 2, 3, 4, 5, 6, 7, 8, 9 ] } )
    // x=0.5 -> lerp(2,3)=2.5 on row nearest(0.5->row1)=row1 [4,5,6] -> lerp(5,6)=5.5
    expect( Sample( grid, [ 0.5, 0.5 ], { combine: [ "linear", "nearest" ] } ) ).toEqual( [ 5.5 ] )
  } )
} )
