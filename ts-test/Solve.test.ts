import { describe, test, expect } from "@jest/globals"
import { Reference } from "../ts/ggg/Language"
import ParseData from "../ts/ggg/ParseData"
import { floor } from "../ts/common/math"
import { GXContext } from "../ts/ggggx"
import { Solve } from "../ts/ggg/Solve"

function testContext() {
  const context = GXContext( { registers: { test: [10,11,12,13,14,15,16,17,18,19] } }  )
  return context
}

describe( "solveNumbers", () => {
  test( "number", () => {
    const src = 1
    const { Solve } = GXContext( )
    const result = [...Solve( src )]
    expect( result ).toEqual( [ 1 ] )
  })

  test( "data", () => {
    const src = "0x11,2e3"
    const { Solve } = GXContext( )
    const result = [...Solve( src )]
    expect( result ).toEqual( [ 17,2000 ] )
  })

  test( "mixed", () => {
    const src = [123, "0x11,2e3", { value: 234 }]
    const { Solve } = testContext()
    const result = [...Solve( src )]
    expect( result ).toEqual([ 123, 17,2000, 234 ])
  })

  test( "register", () => {
    const src = { register: "test", subscript: [0,3,6] } as Reference
    const { Solve } = testContext( )
    const result = [...Solve( src )]
    expect( result ).toEqual([ 10, 13, 16 ])
  })

  test( "register span", () => {
    const src = { register: "test", subscript: {} } as Reference
    const { MatrixResolve, Solve } = testContext()
    const register = MatrixResolve( "test" )
    expect( register ).toBeDefined()
    const result = [...Solve( src ) ]
    expect( result.length ).toEqual( register.getSize() )
  })

  test( "range", () => {
    const src = "10:20/3"
    const { Solve } = testContext()
    const result = [...Solve( src )]
    expect( result ).toEqual([ 10, 15, 20 ])
  })

  test( "multi axis range", () => {
    const src = "1:2|10:20/2|100:200/2"
    const { Solve } = testContext()
    const result = [...Solve( src )]
    expect( result ).toEqual([ 111, 112, 121, 122, 211, 212, 221, 222 ])
  })

  // test( "addition with axis splitter", () => {
  //   const src = "1|2|3"
  //   const result = [...Solve( src )]
  //   expect( result ).toEqual([ 6 ])
  // })

})