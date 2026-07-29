import { describe, expect, test } from "@jest/globals"
import Operators, {
  OperatorApply,
  OperatorFamily,
  OperatorForm,
} from "../ts/ggggx/Operators"

const frozenOperatorMap =
  "0:nop 1:set 2:add 3:mult 4:min 5:max 6:sub 7:div 8:neg 9:clamp " +
  "10:rsub 11:rdiv 12:mod 13:rmod 14:pow 15:rpow 16:mid 17:zero 18:bool " +
  "19:not 20:sign 21:inv 22:abs 23:sqrt 24:inc 25:dec 26:floor 27:ceil " +
  "28:round 29:trunc 30:rand 31:and 32:or 33:xor 34:eq 35:ne 36:lt 37:le " +
  "38:gt 39:ge 40:exp 41:log 42:log2 43:log10 44:hypot 45:sin 46:cos " +
  "47:tan 48:asin 49:acos 50:atan 51:atan2 52:sinh 53:cosh 54:tanh " +
  "55:asinh 56:acosh 57:atanh"

describe( "Operators", () => {
  test( "wire indexes are frozen independently of source organization", () => {
    expect(
      Operators.values().map( item => `${item.index}:${item.name}` ).join( " " ),
    ).toBe( frozenOperatorMap )
  } )

  test( "descriptors expose semantic family and form", () => {
    expect( Operators.get( 2 ) ).toMatchObject( {
      name: "add",
      args: 2,
      family: OperatorFamily.Arithmetic,
      form: OperatorForm.Binary,
    } )
    expect( Operators.get( 8 ) ).toMatchObject( {
      name: "neg",
      args: 1,
      family: OperatorFamily.Unary,
      form: OperatorForm.UnaryZeroMask,
    } )
  } )

  test( "numeric and named forms execute identically", () => {
    expect( OperatorApply( 2, 10, 5 ) ).toBe( 15 )
    expect( OperatorApply( "add", 10, 5 ) ).toBe( 15 )
  } )

  test( "masked unary and binary hypot semantics are explicit", () => {
    expect( OperatorApply( 8, 10, 0 ) ).toBe( -10 )
    expect( OperatorApply( 8, 10, 1 ) ).toBe( 10 )
    expect( OperatorApply( 9, 2, 0 ) ).toBe( 1 )
    expect( OperatorApply( 44, 3, 4 ) ).toBe( 5 )
  } )

  test( "unknown operators do not become set", () => {
    expect( () => OperatorApply( 999, 10, 5 ) ).toThrow( "Unknown operator" )
  } )
} )
