import { isBoolean, isObject } from "../common/util"
import NamedList, { NamedListItem } from "../ggg/NamedList"

const bool = ( a ) => a ? 1 : 0

type OperatorItem = NamedListItem & { 
  args:number
  fn:(...args:any[]) => any
  description?:string
}

export enum Ops {
  nop = "nop",
  set = "set",
  bool = "bool",
  clamp = "clamp",
  zero = "zero",
  rand = "rand",
  dec = "dec",
  inc = "inc",
  neg = "neg",
  not = "not",
  sqrt = "sqrt",
  inv = "inv",
  abs = "abs",
  ceil = "ceil",
  floor = "floor",
  round = "round",
  trunc = "trunc",
  sign = "sign",
  exp = "exp",
  log = "log",
  log10 = "log10",
  log2 = "log2",
  sin = "sin",
  cos = "cos",
  tan = "tan",
  asin = "asin",
  acos = "acos",
  atan = "atan",
  hypot = "hypot",
  sinh = "sinh",
  cosh = "cosh",
  tanh = "tanh",
  asinh = "asinh",
  acosh = "acosh",
  atanh = "atanh",
  add = "add",
  mult = "mult",
  atan2 = "atan2",
  mid = "mid",
  min = "min",
  max = "max",
  or = "or",
  and = "and",
  xor = "xor",
  eq = "eq",
  ne = "ne",
  lt = "lt",
  gt = "gt",
  le = "le",
  ge = "ge",
  sub = "sub",
  div = "div",
  pow = "pow",
  mod = "mod",
  rsub = "rsub",
  rdiv = "rdiv",
  rpow = "rpow",
  rmod = "rmod",
}

// export const OpIndexes = {
//   [Ops.nop]: 0,
//   [Ops.set]: 10,
//   [Ops.bool]: 2,
//   [Ops.clamp]: 3,
//   [Ops.sat]: 4,
// }

const Operators = new NamedList<OperatorItem>({
  [Ops.nop]: { args: 1, fn: (a) => a, description: "No Operation" },
  [Ops.set]: { args: 2, fn: (a:number,b:number) => b, description: "Set" },
  [Ops.bool]: { args: 2, fn: (a:number,b:number) => a ? 1 : 0, description: "Boolean" },
  [Ops.clamp]: { args: 2, fn: (a:number,b:number) => !b ? a : Math.min(1, Math.max(0, a)), description: "Clamp" },
  [Ops.zero]: { args: 2, fn: (a:number,b:number) => !b? 0: a, description: "Zero" },
  [Ops.rand]: { args: 2, fn: (a:number,b:number) => !b? Math.random(): a, description: "Random" },
  [Ops.dec]: { args: 1, fn: (a:number,b:number) => !b ? a - 1 : a, description: "Decrement" },
  [Ops.inc]: { args: 1, fn: (a:number,b:number) => !b ? a + 1 : a, description: "Increment" },
  [Ops.neg]: { args: 1, fn: (a:number,b:number) => !b ? -a : a, description: "Negate" },
  [Ops.not]: { args: 1, fn: (a:number,b:number) => !b ? bool(!a) : a, description: "Not" },
  [Ops.sqrt]: { args: 1, fn: (a:number,b:number) => !b ? Math.sqrt(a) : a, description: "Square Root" },
  [Ops.inv]: { args: 1, fn: (a:number,b:number) => !b ? 1/a : a, description: "Inverse" },
  [Ops.abs]: { args: 1, fn: (a:number,b:number) => !b ? Math.abs(a) : a, description: "Absolute" },
  [Ops.ceil]: { args: 1, fn: (a:number,b:number) => !b ? Math.ceil(a) : a, description: "Ceiling" },
  [Ops.floor]: { args: 1, fn: (a:number,b:number) => !b ? Math.floor(a) : a, description: "Floor" },
  [Ops.round]: { args: 1, fn: (a:number,b:number) => !b ? Math.round(a) : a, description: "Round" },
  [Ops.trunc]: { args: 1, fn: (a:number,b:number) => !b ? Math.trunc(a) : a, description: "Truncate" },
  [Ops.sign]: { args: 1, fn: (a:number,b:number) => !b ? Math.sign(a) : a, description: "Sign" },
  [Ops.exp]: { args: 1, fn: (a:number,b:number) => !b ? Math.exp(a) : a, description: "Exponential" },
  [Ops.log]: { args: 1, fn: (a:number,b:number) => !b ? Math.log(a) : a, description: "Logarithm" },
  [Ops.log10]: { args: 1, fn: (a:number,b:number) => !b ? Math.log10(a) : a, description: "Logarithm Base 10" },
  [Ops.log2]: { args: 1, fn: (a:number,b:number) => !b ? Math.log2(a) : a, description: "Logarithm Base 2" },
  [Ops.sin]: { args: 1, fn: (a:number,b:number) => !b ? Math.sin(a) : a, description: "Sine" },
  [Ops.cos]: { args: 1, fn: (a:number,b:number) => !b ? Math.cos(a) : a, description: "Cosine" },
  [Ops.tan]: { args: 1, fn: (a:number,b:number) => !b ? Math.tan(a) : a, description: "Tangent" },
  [Ops.asin]: { args: 1, fn: (a:number,b:number) => !b ? Math.asin(a) : a, description: "Arcsine" },
  [Ops.acos]: { args: 1, fn: (a:number,b:number) => !b ? Math.acos(a) : a, description: "Arccosine" },
  [Ops.atan]: { args: 1, fn: (a:number,b:number) => !b ? Math.atan(a) : a, description: "Arctangent" },
  [Ops.hypot]: { args: 2, fn: (a:number,b:number) => !b ? Math.hypot(a) : a, description: "Hypotenuse" },
  [Ops.sinh]: { args: 1, fn: (a:number,b:number) => !b ? Math.sinh(a) : a, description: "Hyperbolic Sine" },
  [Ops.cosh]: { args: 1, fn: (a:number,b:number) => !b ? Math.cosh(a) : a, description: "Hyperbolic Cosine" },
  [Ops.tanh]: { args: 1, fn: (a:number,b:number) => !b ? Math.tanh(a) : a, description: "Hyperbolic Tangent" },
  [Ops.asinh]: { args: 1, fn: (a:number,b:number) => !b ? Math.asinh(a) : a, description: "Hyperbolic Arcsine" },
  [Ops.acosh]: { args: 1, fn: (a:number,b:number) => !b ? Math.acosh(a) : a, description: "Hyperbolic Arccosine" },
  [Ops.atanh]: { args: 1, fn: (a:number,b:number) => !b ? Math.atanh(a) : a, description: "Hyperbolic Arctangent" },

  [Ops.add]: { args: 2, fn: (a:number,b:number) => a + b, description: "Add" },
  [Ops.mult]: { args: 2, fn: (a:number,b:number) => a * b, description: "Multiply" },
  [Ops.atan2]: { args: 2, fn: (a:number,b:number) => Math.atan2(a,b), description: "Arctangent 2" },

  [Ops.mid]: { args: 2, fn: (a:number,b:number) => (a + b)/2, description: "Midpoint" },
  [Ops.min]: { args: 2, fn: (a:number,b:number) => Math.min(a,b), description: "Minimum" },
  [Ops.max]: { args: 2, fn: (a:number,b:number) => Math.max(a,b), description: "Maximum" },

  [Ops.or]: { args: 2, fn: (a:number,b:number) => bool(a || b) },
  [Ops.and]: { args: 2, fn: (a:number,b:number) => bool(a && b) },
  [Ops.xor]: { args: 2, fn: (a:number,b:number) => bool(a ^ b) },

  [Ops.eq]: { args: 2, fn: (a:number,b:number) => bool(a === b), description: "Equal" },
  [Ops.ne]: { args: 2, fn: (a:number,b:number) => bool(a !== b), description: "Not Equal" },
  [Ops.lt]: { args: 2, fn: (a:number,b:number) => bool(a < b), description: "Less Than" },
  [Ops.gt]: { args: 2, fn: (a:number,b:number) => bool(a > b), description: "Greater Than" },
  [Ops.le]: { args: 2, fn: (a:number,b:number) => bool(a <= b), description: "Less Than or Equal" },
  [Ops.ge]: { args: 2, fn: (a:number,b:number) => bool(a >= b), description: "Greater Than or Equal" },

  [Ops.sub]: { args: 2, fn: (a:number,b:number) => a - b, description: "Subtract" },
  [Ops.div]: { args: 2, fn: (a:number,b:number) => a / b, description: "Divide" },
  [Ops.pow]: { args: 2, fn: (a:number,b:number) => a ** b, description: "Power" },
  [Ops.mod]: { args: 2, fn: (a:number,b:number) => a % b, description: "Modulus" },

  [Ops.rsub]: { args: 2, fn: (a:number,b:number) => b - a, description: "Reverse Subtract" },
  [Ops.rdiv]: { args: 2, fn: (a:number,b:number) => b / a, description: "Reverse Divide" },
  [Ops.rpow]: { args: 2, fn: (a:number,b:number) => b ** a, description: "Reverse Power" },
  [Ops.rmod]: { args: 2, fn: (a:number,b:number) => b % a, description: "Reverse Modulus" },
})

// Operators.code = GGG.Operator
// Operators.name = "gggOperators"
// Operators.description = "Operators"

export function OperatorApply( operator:string | number | boolean | OperatorItem, a:number, b:number ) : number {
  
  if ( isBoolean( operator ) ) {
    operator = operator ? Ops.set : Ops.nop
  }

  switch ( operator ) {
    case Ops.nop:
      // nop
      return a

    case Ops.set:
      // set
      return b
  }

  const op = isObject( operator ) ? operator : Operators.get( operator )
  if ( op ) {
    return op.fn( a, b )
  }
  
  throw new Error( `Unknown operator: ${operator}` )
}

export default Operators