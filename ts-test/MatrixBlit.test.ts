import { describe, test, expect } from "@jest/globals"
import Machine from "../ts/ggg/Machine"
import Matrix from "../ts/ggg/Matrix"
import { GXCommands } from "../ts/ggggx/GXCommands"

function ggggxMachine() {
  return new Machine( { commands: GXCommands } )
}

// Build a machine with a 3x3 source (index 0 = 1..9) and a zeroed 3x3 dest
// (index 1), run a G40 blit, and return the destination's data.
async function blit( program: string ): Promise<number[]> {
  const machine = ggggxMachine()
  await machine.run(
    "G30 R0 S3,3\n" +
    "G20 R0 V1,2,3,4,5,6,7,8,9\n" +
    "G30 R1 S3,3\n" +
    program + "\n"
  )
  const dest = machine.getMatrix( 1 ) as Matrix
  return [ ...dest.data ]
}

describe( "MatrixBlit (G40)", () => {
  test( "an unknown mode falls back to an identity copy (identity is no longer a mode)", async () => {
    expect( await blit( 'G40 R0 W1 T"identity"' ) )
      .toEqual( [ 1, 2, 3, 4, 5, 6, 7, 8, 9 ] )
  } )

  test( "affine identity copies the source", async () => {
    expect( await blit( 'G40 R0 W1 T"affine" M1,0,0,0,1,0' ) )
      .toEqual( [ 1, 2, 3, 4, 5, 6, 7, 8, 9 ] )
  } )

  test( "default (no mode) is a full-source box -- identity copy", async () => {
    expect( await blit( "G40 R0 W1" ) )
      .toEqual( [ 1, 2, 3, 4, 5, 6, 7, 8, 9 ] )
  } )

  test( "explicit full-source box copies the source", async () => {
    expect( await blit( 'G40 R0 W1 T"box" M0,3,0,3' ) )
      .toEqual( [ 1, 2, 3, 4, 5, 6, 7, 8, 9 ] )
  } )

  test( "box sub-region [1,3] selects + stretches source columns (nearest, F1)", async () => {
    expect( await blit( 'G40 R0 W1 T"box" M1,3,0,3 F1' ) )
      .toEqual( [ 2, 2, 3, 5, 5, 6, 8, 8, 9 ] )
  } )

  test( "map transposes by pointing each dest axis at the other source axis", async () => {
    expect( await blit( 'G40 R0 W1 T"map" M1,0,3,0,0,3 F1' ) )
      .toEqual( [ 1, 4, 7, 2, 5, 8, 3, 6, 9 ] )
  } )

  test( "map rotates a quarter turn (swap axes + reverse one range)", async () => {
    expect( await blit( 'G40 R0 W1 T"map" M1,2.5,-0.5,0,0,3 F1' ) )
      .toEqual( [ 7, 4, 1, 8, 5, 2, 9, 6, 3 ] )
  } )

  test( "half-extent box [0,1.5] nearest magnifies the top-left (F1 = nearest)", async () => {
    expect( await blit( 'G40 R0 W1 T"box" M0,1.5,0,1.5 F1' ) )
      .toEqual( [ 1, 1, 2, 1, 1, 2, 4, 4, 5 ] )
  } )

  test( "per-axis filter F0,1: linear on X, nearest on Y; names compose too", async () => {
    expect( await blit( 'G40 R0 W1 T"box" M0,1.5,0,1.5 F0,1' ) )
      .toEqual( [ 1, 1.5, 2, 1, 1.5, 2, 4, 4.5, 5 ] )
    expect( await blit( 'G40 R0 W1 T"box" M0,1.5,0,1.5 F"linear","nearest"' ) )
      .toEqual( [ 1, 1.5, 2, 1, 1.5, 2, 4, 4.5, 5 ] )
  } )

  test( "operator add accumulates onto the destination", async () => {
    // Write 10 into every dest cell first, then add an identity blit.
    const machine = ggggxMachine()
    await machine.run(
      "G30 R0 S3,3\n" +
      "G20 R0 V1,2,3,4,5,6,7,8,9\n" +
      "G30 R1 S3,3\n" +
      "G20 R1 V10,10,10,10,10,10,10,10,10\n" +
      'G40 R0 W1 Q"add"\n'
    )
    const dest = machine.getMatrix( 1 ) as Matrix
    expect( [ ...dest.data ] ).toEqual( [ 11, 12, 13, 14, 15, 16, 17, 18, 19 ] )
  } )

  test( "minify: default linear lerps (aliases); F2 means; F4 max-pools; F4,2 pools per axis (hold E1)", async () => {
    // default (no fold) on a 1.5x box = lerp the centre, no footprint reduction
    expect( await blit( 'G40 R0 W1 T"box" M0,4.5,0,4.5 E1' ) )
      .toEqual( [ 1, 2.5, 3, 5.5, 7.25, 7.5, 7, 8.5, 9 ] )
    // explicit mean (F2) on a 2x box anti-aliases
    expect( await blit( 'G40 R0 W1 T"box" M0,6,0,6 F2 E1' ) )
      .toEqual( [ 1, 2.75, 3, 5.5, 7.25, 7.5, 7, 8.75, 9 ] )
    expect( await blit( 'G40 R0 W1 T"box" M0,6,0,6 F4 E1' ) )
      .toEqual( [ 1, 3, 3, 7, 9, 9, 7, 9, 9 ] )
    expect( await blit( 'G40 R0 W1 T"box" M0,6,0,6 F4,2 E1' ) )
      .toEqual( [ 1, 3, 3, 5.5, 7.5, 7.5, 7, 9, 9 ] )
  } )

  test( "missing source register reports OZ", async () => {
    const machine = ggggxMachine()
    await machine.run( "G30 R1 S3,3\n" )
    const out = await machine.run( 'G40 R0 W1\n' )
    const last = out[ out.length - 1 ]
    expect( last.code ).toEqual( "OZ" )
  } )
} )
