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
  test( "identity copies the source", async () => {
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

  test( "box sub-region [1,3] selects + stretches source columns (nearest)", async () => {
    expect( await blit( 'G40 R0 W1 T"box" M1,3,0,3 E"nearest"' ) )
      .toEqual( [ 2, 2, 3, 5, 5, 6, 8, 8, 9 ] )
  } )

  test( "half-extent box [0,1.5] nearest magnifies the top-left (filter by name)", async () => {
    // E positional: [ filter, edge, coord ]; nearest filter.
    expect( await blit( 'G40 R0 W1 T"box" M0,1.5,0,1.5 E"nearest"' ) )
      .toEqual( [ 1, 1, 2, 1, 1, 2, 4, 4, 5 ] )
  } )

  test( "filter by index (1 = nearest) magnifies; box by index (T0)", async () => {
    expect( await blit( "G40 R0 W1 T0 M0,1.5,0,1.5 E1" ) )
      .toEqual( [ 1, 1, 2, 1, 1, 2, 4, 4, 5 ] )
  } )

  test( "operator add accumulates onto the destination", async () => {
    // Write 10 into every dest cell first, then add an identity blit.
    const machine = ggggxMachine()
    await machine.run(
      "G30 R0 S3,3\n" +
      "G20 R0 V1,2,3,4,5,6,7,8,9\n" +
      "G30 R1 S3,3\n" +
      "G20 R1 V10,10,10,10,10,10,10,10,10\n" +
      'G40 R0 W1 T"identity" Q"add"\n'
    )
    const dest = machine.getMatrix( 1 ) as Matrix
    expect( [ ...dest.data ] ).toEqual( [ 11, 12, 13, 14, 15, 16, 17, 18, 19 ] )
  } )

  test( "oversized box [0,6] + mid reduce minifies (E slot 3 = reduce, by index)", async () => {
    // E0,0,0,0 = linear, hold, normalized, reduce=mid (ReduceList index 0).
    expect( await blit( 'G40 R0 W1 T"box" M0,6,0,6 E0,0,0,0' )
      .then( d => d.map( v => +v.toFixed( 4 ) ) ) )
      .toEqual( [ 2.1875, 3.5625, 3.75, 6.6875, 8.0625, 8.25, 7.25, 8.75, 9 ] )
  } )

  test( "missing source register reports OZ", async () => {
    const machine = ggggxMachine()
    await machine.run( "G30 R1 S3,3\n" )
    const out = await machine.run( 'G40 R0 W1 T"identity"\n' )
    const last = out[ out.length - 1 ]
    expect( last.code ).toEqual( "OZ" )
  } )
} )
