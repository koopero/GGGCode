import { describe, test, expect } from "@jest/globals"
import Matrix from "../ts/ggg/Matrix"
import { MatrixWrite } from "../ts/ggggx/MatrixWrite"
import { TestGXProgramResult } from "./test-utils"
import { GXCommandNames as GXCN } from "../ts/ggggx/GXLanguage"
import { GGG } from "../ts/ggg/Language"

describe("MatrixWrite", () => {
  describe("Typescript", () => {
    test("will write matrix", () => {
      const matrix = new Matrix( { dim: [2,3] } )
      const result = MatrixWrite( matrix, [1,2,3,4,5,6] )
      expect( result.matrix ).toEqual( matrix )
      expect( matrix.data ).toEqual( [1,2,3,4,5,6] )
    })

    test("will create matrix if not provided", () => {
      const result = MatrixWrite( undefined, { data: [1,2,3,4], offset: 1 } )
      expect( result.matrix ).toBeInstanceOf( Matrix )
      expect( result.matrix.data ).toEqual( [0,1,2,3] )
    })

    test("will fill and create", () => {
      const result = MatrixWrite( undefined, { data: [1,2], size: [4], fill: true } )
      expect( result.matrix ).toBeInstanceOf( Matrix )
      expect( result.matrix.data ).toEqual( [1,2,1,2] )
    })

    test("will fill", () => {
      const matrix = new Matrix( { dim: [4] } )
      const result = MatrixWrite( matrix, { data: [1,2], fill: true } )
      expect( result.matrix ).toEqual( matrix )
      expect( matrix.data ).toEqual( [1,2,1,2] )
    })  

    test("will use operator", () => {
      const matrix = new Matrix( { dim: [4], data: [1,2,3,4] } )
      const result = MatrixWrite( matrix, { data: [1,1,1,1], operator: "add" } )
      expect( result.matrix ).toEqual( matrix )
      expect( matrix.data ).toEqual( [2,3,4,5] )
    })

    test("staggered write, explicit size", () => {
      const matrix = new Matrix( { dim: [2,2], data: [1,2,3,4] } )
      const result = MatrixWrite( matrix, { data: [20,40], offset: 1, size: [1,2] } )
      expect( result.matrix ).toEqual( matrix )
      expect( matrix.data ).toEqual( [1,20,3,40] )
    })

    test("staggered write, implicit size", () => {
      const matrix = new Matrix( { dim: [2,2], data: [1,2,3,4] } )
      const result = MatrixWrite( matrix, { data: [20,40], offset: 1 } )
      expect( result.matrix ).toEqual( matrix )
      expect( matrix.data ).toEqual( [1,20,3,40] )
    })

    test("area fill", () => {
      const matrix = new Matrix( { dim: [3,3] } )
      MatrixWrite( matrix, { data: [1], size: [2,2], fill: true, offset: [0,1] } )
      expect( matrix.data ).toEqual( [
        0,0,0,
        1,1,0,
        1,1,0,
      ] )
    })

    test("clipped fill", () => {
      const matrix = new Matrix( { dim: [3,3] } )
      MatrixWrite( matrix, { data: [1], size: [2,2], fill: true, offset: [2,2] } )
      expect( matrix.data ).toEqual( [
        0,0,0,
        0,0,0,
        0,0,1,
      ] )
    })
  })

  describe("GGGCode", () => {
    TestGXProgramResult( "minimal init, write and display matrix", `
      ${GXCN.MatrixInit} ${GGG.Register}0 ${GGG.Size}2,3
      ${GXCN.MatrixWrite} ${GGG.Register}0 ${GGG.Value}1,2,3,4,5,6
      ${GXCN.MatrixDisplay} ${GGG.Register}0
    `, [ 1,2,3,4,5,6 ] )

    // Reference a buffer by name (L) for the write, with the V slot.
    TestGXProgramResult( "write by name via V slot", `
      ${GXCN.MatrixInit} ${GGG.Register}0 ${GGG.Alias}"foo" ${GGG.Size}5
      ${GXCN.MatrixWrite} ${GGG.Alias}"foo" ${GGG.Value}10:40/4
      ${GXCN.MatrixDisplay} ${GGG.Register}0
    `, [ 10,20,30,40,0 ] )

    TestGXProgramResult( "matrix write with offset and size", `
      ${GXCN.MatrixInit} ${GGG.Register}0 ${GGG.Size}2,3
      ${GXCN.MatrixWrite} ${GGG.Register}0 ${GGG.Offset}1 ${GGG.Size}1,2 ${GGG.Value}20,40
      ${GXCN.MatrixDisplay} ${GGG.Register}0
    `, [ 0,20,0,40,0,0 ] )

    TestGXProgramResult( "matrix write with fill", `
      ${GXCN.MatrixInit} ${GGG.Register}0 ${GGG.Size}3,3
      ${GXCN.MatrixWrite} ${GGG.Register}0 ${GGG.Offset}0,1 ${GGG.Repeat}K ${GGG.Size}2,2 ${GGG.Value}1
      ${GXCN.MatrixDisplay} ${GGG.Register}0
    `, [
      0,0,0,
      1,1,0,
      1,1,0,
    ] )

    TestGXProgramResult( "add fills", `
      ${GXCN.MatrixInit} ${GGG.Register}0 ${GGG.Size}3,3
      ${GXCN.MatrixWrite} ${GGG.Register}0 ${GGG.Offset}0,1 ${GGG.Repeat}K ${GGG.Size}2,2 ${GGG.Value}1
      ${GXCN.MatrixWrite} ${GGG.Register}0 ${GGG.Offset}1,0 ${GGG.Repeat}K ${GGG.Operator}"add" ${GGG.Size}2,2 ${GGG.Value}10
      ${GXCN.MatrixDisplay} ${GGG.Register}0
    `, [
      0,10,10,
      1,11,10,
      1,1,0,
    ] )

    TestGXProgramResult( "mult fills", `
      ${GXCN.MatrixInit} ${GGG.Register}0 ${GGG.Size}3,3
      ${GXCN.MatrixWrite} ${GGG.Register}0 ${GGG.Offset}0,1 ${GGG.Repeat}K ${GGG.Size}2,2 ${GGG.Value}1
      ${GXCN.MatrixWrite} ${GGG.Register}0 ${GGG.Offset}1,0 ${GGG.Repeat}K ${GGG.Operator}"mult" ${GGG.Size}2,2 ${GGG.Value}2
      ${GXCN.MatrixDisplay} ${GGG.Register}0
    `, [
      0,0,0,
      1,2,0,
      1,1,0,
    ] )

    TestGXProgramResult( "write range", `
      ${GXCN.MatrixInit} ${GGG.Register}0 ${GGG.Size}5
      ${GXCN.MatrixWrite} ${GGG.Register}0 ${GGG.Value}10:40/4
      ${GXCN.MatrixDisplay} ${GGG.Register}0
    `, [ 10,20,30,40,0 ] )

    false && TestGXProgramResult( "offset abuse", `
      ${GXCN.MatrixInit} ${GGG.Register}0 ${GGG.Size}3,3
      ${GXCN.MatrixWrite} ${GGG.Register}0 ${GGG.Offset}4 ${GGG.Value}1,2,3,4
      ${GXCN.MatrixDisplay} ${GGG.Register}0
    `, [  0,0,0,
          0,1,2,
          3,4,0 ] )
  })
})