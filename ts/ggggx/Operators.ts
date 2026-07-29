import { isBoolean, isObject } from "../common/util"
import NamedList, { NamedListItem } from "../ggg/NamedList"

const bool = ( value:any ) => value ? 1 : 0

export enum OperatorFamily {
  Write = "write",
  Arithmetic = "arithmetic",
  Unary = "unary",
  Control = "control",
  Logical = "logical",
  Comparison = "comparison",
  Exponential = "exponential",
  Circular = "circular",
  Hyperbolic = "hyperbolic",
}

export enum OperatorForm {
  Passthrough = "passthrough",
  Replace = "replace",
  Binary = "binary",
  Unary = "unary",
  UnaryZeroMask = "unary-zero-mask",
  NullaryZeroMask = "nullary-zero-mask",
}

// Stable wire names. Their numeric values are owned separately by OpIndexes:
// source/display order may change, but a published Q value must never move.
export enum Ops {
  nop = "nop",
  set = "set",
  add = "add",
  mult = "mult",
  min = "min",
  max = "max",
  sub = "sub",
  div = "div",
  neg = "neg",
  clamp = "clamp",
  rsub = "rsub",
  rdiv = "rdiv",
  mod = "mod",
  rmod = "rmod",
  pow = "pow",
  rpow = "rpow",
  mid = "mid",
  zero = "zero",
  bool = "bool",
  not = "not",
  sign = "sign",
  inv = "inv",
  abs = "abs",
  sqrt = "sqrt",
  inc = "inc",
  dec = "dec",
  floor = "floor",
  ceil = "ceil",
  round = "round",
  trunc = "trunc",
  rand = "rand",
  and = "and",
  or = "or",
  xor = "xor",
  eq = "eq",
  ne = "ne",
  lt = "lt",
  le = "le",
  gt = "gt",
  ge = "ge",
  exp = "exp",
  log = "log",
  log2 = "log2",
  log10 = "log10",
  hypot = "hypot",
  sin = "sin",
  cos = "cos",
  tan = "tan",
  asin = "asin",
  acos = "acos",
  atan = "atan",
  atan2 = "atan2",
  sinh = "sinh",
  cosh = "cosh",
  tanh = "tanh",
  asinh = "asinh",
  acosh = "acosh",
  atanh = "atanh",
}

// Frozen numeric values published by D5 and accepted by Q. These are explicit
// rather than NamedList insertion positions so reorganizing this file cannot
// silently change the wire protocol.
export enum OpIndexes {
  nop = 0,
  set = 1,
  add = 2,
  mult = 3,
  min = 4,
  max = 5,
  sub = 6,
  div = 7,
  neg = 8,
  clamp = 9,
  rsub = 10,
  rdiv = 11,
  mod = 12,
  rmod = 13,
  pow = 14,
  rpow = 15,
  mid = 16,
  zero = 17,
  bool = 18,
  not = 19,
  sign = 20,
  inv = 21,
  abs = 22,
  sqrt = 23,
  inc = 24,
  dec = 25,
  floor = 26,
  ceil = 27,
  round = 28,
  trunc = 29,
  rand = 30,
  and = 31,
  or = 32,
  xor = 33,
  eq = 34,
  ne = 35,
  lt = 36,
  le = 37,
  gt = 38,
  ge = 39,
  exp = 40,
  log = 41,
  log2 = 42,
  log10 = 43,
  hypot = 44,
  sin = 45,
  cos = 46,
  tan = 47,
  asin = 48,
  acos = 49,
  atan = 50,
  atan2 = 51,
  sinh = 52,
  cosh = 53,
  tanh = 54,
  asinh = 55,
  acosh = 56,
  atanh = 57,
}

export type OperatorItem = NamedListItem & {
  index:number
  name:Ops
  args:number
  family:OperatorFamily
  form:OperatorForm
  fn:( current:number, incoming:number ) => number
  description:string
}

function op(
  index:OpIndexes,
  name:Ops,
  args:number,
  family:OperatorFamily,
  form:OperatorForm,
  description:string,
  fn:( current:number, incoming:number ) => number,
): OperatorItem {
  return { index, name, args, family, form, description, fn }
}

function binary(
  index:OpIndexes,
  name:Ops,
  family:OperatorFamily,
  description:string,
  fn:( current:number, incoming:number ) => number,
) {
  return op( index, name, 2, family, OperatorForm.Binary, description, fn )
}

function unary(
  index:OpIndexes,
  name:Ops,
  family:OperatorFamily,
  description:string,
  fn:( current:number ) => number,
) {
  return op( index, name, 1, family, OperatorForm.Unary, description, ( current ) => fn( current ) )
}

function unaryZeroMask(
  index:OpIndexes,
  name:Ops,
  family:OperatorFamily,
  description:string,
  fn:( current:number ) => number,
) {
  return op(
    index,
    name,
    1,
    family,
    OperatorForm.UnaryZeroMask,
    description,
    ( current, incoming ) => incoming === 0 ? fn( current ) : current,
  )
}

const Operators = new NamedList<OperatorItem>( [
  op( OpIndexes.nop, Ops.nop, 1, OperatorFamily.Write, OperatorForm.Passthrough,
    "Keep the current value.", current => current ),
  op( OpIndexes.set, Ops.set, 1, OperatorFamily.Write, OperatorForm.Replace,
    "Replace the current value with the incoming value.", ( current, incoming ) => incoming ),

  binary( OpIndexes.add, Ops.add, OperatorFamily.Arithmetic,
    "Add: current + incoming.", ( current, incoming ) => current + incoming ),
  binary( OpIndexes.mult, Ops.mult, OperatorFamily.Arithmetic,
    "Multiply: current * incoming.", ( current, incoming ) => current * incoming ),
  binary( OpIndexes.min, Ops.min, OperatorFamily.Arithmetic,
    "Minimum of current and incoming.", Math.min ),
  binary( OpIndexes.max, Ops.max, OperatorFamily.Arithmetic,
    "Maximum of current and incoming.", Math.max ),
  binary( OpIndexes.sub, Ops.sub, OperatorFamily.Arithmetic,
    "Subtract: current - incoming.", ( current, incoming ) => current - incoming ),
  binary( OpIndexes.div, Ops.div, OperatorFamily.Arithmetic,
    "Divide: current / incoming.", ( current, incoming ) => current / incoming ),
  unaryZeroMask( OpIndexes.neg, Ops.neg, OperatorFamily.Unary,
    "Negate current where incoming is zero.", current => -current ),
  unaryZeroMask( OpIndexes.clamp, Ops.clamp, OperatorFamily.Unary,
    "Clamp current to 0..1 where incoming is zero.", current => Math.min( 1, Math.max( 0, current ) ) ),

  binary( OpIndexes.rsub, Ops.rsub, OperatorFamily.Arithmetic,
    "Reverse subtract: incoming - current.", ( current, incoming ) => incoming - current ),
  binary( OpIndexes.rdiv, Ops.rdiv, OperatorFamily.Arithmetic,
    "Reverse divide: incoming / current.", ( current, incoming ) => incoming / current ),
  binary( OpIndexes.mod, Ops.mod, OperatorFamily.Arithmetic,
    "Remainder: current % incoming.", ( current, incoming ) => current % incoming ),
  binary( OpIndexes.rmod, Ops.rmod, OperatorFamily.Arithmetic,
    "Reverse remainder: incoming % current.", ( current, incoming ) => incoming % current ),
  binary( OpIndexes.pow, Ops.pow, OperatorFamily.Arithmetic,
    "Power: current raised to incoming.", ( current, incoming ) => current ** incoming ),
  binary( OpIndexes.rpow, Ops.rpow, OperatorFamily.Arithmetic,
    "Reverse power: incoming raised to current.", ( current, incoming ) => incoming ** current ),
  binary( OpIndexes.mid, Ops.mid, OperatorFamily.Arithmetic,
    "Midpoint of current and incoming.", ( current, incoming ) => ( current + incoming ) / 2 ),

  op( OpIndexes.zero, Ops.zero, 0, OperatorFamily.Control, OperatorForm.NullaryZeroMask,
    "Write zero where incoming is zero; otherwise keep current.",
    ( current, incoming ) => incoming === 0 ? 0 : current ),
  unary( OpIndexes.bool, Ops.bool, OperatorFamily.Logical,
    "Convert current to 0 or 1.", current => bool( current ) ),
  unaryZeroMask( OpIndexes.not, Ops.not, OperatorFamily.Logical,
    "Logical-not current where incoming is zero.", current => bool( !current ) ),
  unaryZeroMask( OpIndexes.sign, Ops.sign, OperatorFamily.Unary,
    "Sign of current where incoming is zero.", Math.sign ),
  unaryZeroMask( OpIndexes.inv, Ops.inv, OperatorFamily.Unary,
    "Reciprocal of current where incoming is zero.", current => 1 / current ),
  unaryZeroMask( OpIndexes.abs, Ops.abs, OperatorFamily.Unary,
    "Absolute value of current where incoming is zero.", Math.abs ),
  unaryZeroMask( OpIndexes.sqrt, Ops.sqrt, OperatorFamily.Unary,
    "Square root of current where incoming is zero.", Math.sqrt ),
  unaryZeroMask( OpIndexes.inc, Ops.inc, OperatorFamily.Unary,
    "Increment current where incoming is zero.", current => current + 1 ),
  unaryZeroMask( OpIndexes.dec, Ops.dec, OperatorFamily.Unary,
    "Decrement current where incoming is zero.", current => current - 1 ),
  unaryZeroMask( OpIndexes.floor, Ops.floor, OperatorFamily.Unary,
    "Floor current where incoming is zero.", Math.floor ),
  unaryZeroMask( OpIndexes.ceil, Ops.ceil, OperatorFamily.Unary,
    "Ceiling of current where incoming is zero.", Math.ceil ),
  unaryZeroMask( OpIndexes.round, Ops.round, OperatorFamily.Unary,
    "Round current where incoming is zero.", Math.round ),
  unaryZeroMask( OpIndexes.trunc, Ops.trunc, OperatorFamily.Unary,
    "Truncate current where incoming is zero.", Math.trunc ),
  op( OpIndexes.rand, Ops.rand, 0, OperatorFamily.Control, OperatorForm.NullaryZeroMask,
    "Write a random value in [0,1) where incoming is zero; otherwise keep current.",
    ( current, incoming ) => incoming === 0 ? Math.random() : current ),

  binary( OpIndexes.and, Ops.and, OperatorFamily.Logical,
    "Logical AND of current and incoming.", ( current, incoming ) => bool( current && incoming ) ),
  binary( OpIndexes.or, Ops.or, OperatorFamily.Logical,
    "Logical OR of current and incoming.", ( current, incoming ) => bool( current || incoming ) ),
  binary( OpIndexes.xor, Ops.xor, OperatorFamily.Logical,
    "Bitwise XOR of current and incoming, normalized to 0 or 1.",
    ( current, incoming ) => bool( current ^ incoming ) ),
  binary( OpIndexes.eq, Ops.eq, OperatorFamily.Comparison,
    "1 when current equals incoming, otherwise 0.", ( current, incoming ) => bool( current === incoming ) ),
  binary( OpIndexes.ne, Ops.ne, OperatorFamily.Comparison,
    "1 when current differs from incoming, otherwise 0.", ( current, incoming ) => bool( current !== incoming ) ),
  binary( OpIndexes.lt, Ops.lt, OperatorFamily.Comparison,
    "1 when current is less than incoming, otherwise 0.", ( current, incoming ) => bool( current < incoming ) ),
  binary( OpIndexes.le, Ops.le, OperatorFamily.Comparison,
    "1 when current is at most incoming, otherwise 0.", ( current, incoming ) => bool( current <= incoming ) ),
  binary( OpIndexes.gt, Ops.gt, OperatorFamily.Comparison,
    "1 when current is greater than incoming, otherwise 0.", ( current, incoming ) => bool( current > incoming ) ),
  binary( OpIndexes.ge, Ops.ge, OperatorFamily.Comparison,
    "1 when current is at least incoming, otherwise 0.", ( current, incoming ) => bool( current >= incoming ) ),

  unaryZeroMask( OpIndexes.exp, Ops.exp, OperatorFamily.Exponential,
    "Exponential of current where incoming is zero.", Math.exp ),
  unaryZeroMask( OpIndexes.log, Ops.log, OperatorFamily.Exponential,
    "Natural logarithm of current where incoming is zero.", Math.log ),
  unaryZeroMask( OpIndexes.log2, Ops.log2, OperatorFamily.Exponential,
    "Base-2 logarithm of current where incoming is zero.", Math.log2 ),
  unaryZeroMask( OpIndexes.log10, Ops.log10, OperatorFamily.Exponential,
    "Base-10 logarithm of current where incoming is zero.", Math.log10 ),

  binary( OpIndexes.hypot, Ops.hypot, OperatorFamily.Circular,
    "Euclidean norm of current and incoming.", Math.hypot ),
  unaryZeroMask( OpIndexes.sin, Ops.sin, OperatorFamily.Circular,
    "Sine of current radians where incoming is zero.", Math.sin ),
  unaryZeroMask( OpIndexes.cos, Ops.cos, OperatorFamily.Circular,
    "Cosine of current radians where incoming is zero.", Math.cos ),
  unaryZeroMask( OpIndexes.tan, Ops.tan, OperatorFamily.Circular,
    "Tangent of current radians where incoming is zero.", Math.tan ),
  unaryZeroMask( OpIndexes.asin, Ops.asin, OperatorFamily.Circular,
    "Arcsine of current where incoming is zero.", Math.asin ),
  unaryZeroMask( OpIndexes.acos, Ops.acos, OperatorFamily.Circular,
    "Arccosine of current where incoming is zero.", Math.acos ),
  unaryZeroMask( OpIndexes.atan, Ops.atan, OperatorFamily.Circular,
    "Arctangent of current where incoming is zero.", Math.atan ),
  binary( OpIndexes.atan2, Ops.atan2, OperatorFamily.Circular,
    "Two-argument arctangent atan2(current, incoming).", Math.atan2 ),

  unaryZeroMask( OpIndexes.sinh, Ops.sinh, OperatorFamily.Hyperbolic,
    "Hyperbolic sine of current where incoming is zero.", Math.sinh ),
  unaryZeroMask( OpIndexes.cosh, Ops.cosh, OperatorFamily.Hyperbolic,
    "Hyperbolic cosine of current where incoming is zero.", Math.cosh ),
  unaryZeroMask( OpIndexes.tanh, Ops.tanh, OperatorFamily.Hyperbolic,
    "Hyperbolic tangent of current where incoming is zero.", Math.tanh ),
  unaryZeroMask( OpIndexes.asinh, Ops.asinh, OperatorFamily.Hyperbolic,
    "Inverse hyperbolic sine of current where incoming is zero.", Math.asinh ),
  unaryZeroMask( OpIndexes.acosh, Ops.acosh, OperatorFamily.Hyperbolic,
    "Inverse hyperbolic cosine of current where incoming is zero.", Math.acosh ),
  unaryZeroMask( OpIndexes.atanh, Ops.atanh, OperatorFamily.Hyperbolic,
    "Inverse hyperbolic tangent of current where incoming is zero.", Math.atanh ),
] )

export function OperatorResolve(
  operator:string | number | boolean | OperatorItem,
): OperatorItem | undefined {
  if ( isBoolean( operator ) )
    operator = operator ? Ops.set : Ops.nop
  return isObject( operator ) ? operator as OperatorItem : Operators.get( operator )
}

export function OperatorApply( operator:string | number | boolean | OperatorItem, a:number, b:number ) : number {
  const op = OperatorResolve( operator )
  if ( op )
    return op.fn( a, b )

  throw new Error( `Unknown operator: ${operator}` )
}

export default Operators
