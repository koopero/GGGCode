import gggNamedList, { gggNamedListItem } from "../ggg/gggNamedList"

const bool = ( a ) => a ? 1 : 0

type OperatorItem = gggNamedListItem & { 
  args:number
  fn:(...args:any[]) => any
  description?:string
}

const Boolish = 0x100
const Compare = 0x200


enum gggOps {
  nop = 'nop',
  set = 'set',
  bool = 'bool',
  clamp = 'clamp',
  sat = 'sat',
  ssat = 'ssat',
  zero = 'zero',
  rand = 'rand',
  dec = 'dec',
  inc = 'inc',
  neg = 'neg',
  not = 'not',
  sqrt = 'sqrt',
  inv = 'inv',
  abs = 'abs',
  ceil = 'ceil',
  floor = 'floor',
  round = 'round',
  trunc = 'trunc',
  sign = 'sign',
  exp = 'exp',
  log = 'log',
  log10 = 'log10',
  log2 = 'log2',
  sin = 'sin',
  cos = 'cos',
  tan = 'tan',
  asin = 'asin',
  acos = 'acos',
  atan = 'atan',
  hypot = 'hypot',
  sinh = 'sinh',
  cosh = 'cosh',
  tanh = 'tanh',
  asinh = 'asinh',
  acosh = 'acosh',
  atanh = 'atanh',
  add = 'add',
  mul = 'mul',
  atan2 = 'atan2',
  mid = 'mid',
  min = 'min',
  max = 'max',
  or = 'or',
  and = 'and',
  xor = 'xor',
  eq = 'eq',
  ne = 'ne',
  lt = 'lt',
  gt = 'gt',
  le = 'le',
  ge = 'ge',
  sub = 'sub',
  div = 'div',
  pow = 'pow',
  mod = 'mod',
  rsub = 'rsub',
  rdiv = 'rdiv',
  rpow = 'rpow',
  rmod = 'rmod',
}

const gggOperators = new gggNamedList<OperatorItem>({
  [gggOps.nop]: { args: 1, fn: (a) => a },
  [gggOps.set]: { args: 2, fn: (a, b) => b },

  [gggOps.bool]: { args: 2, fn: (a,b) => a ? 1 : 0 },
  [gggOps.clamp]: { args: 2, fn: (a,b) => !b ? a : Math.min(1, Math.max(0, a)) },

  [gggOps.zero]: { args: 2, fn: (a,b) => !b? 0: a, description: "Zero" },
  [gggOps.rand]: { args: 2, fn: (a,b) => !b? Math.random(): a, description: "Random" },
  [gggOps.dec]: { args: 1, fn: (a,b) => !b ? a - 1 : a, description: "Decrement" },
  [gggOps.inc]: { args: 1, fn: (a,b) => !b ? a + 1 : a, description: "Increment" },
  [gggOps.neg]: { args: 1, fn: (a,b) => !b ? -a : a, description: "Negate" },
  [gggOps.not]: { args: 1, fn: (a,b) => !b ? bool(!a) : a, description: "Not" },
  [gggOps.sqrt]: { args: 1, fn: (a,b) => !b ? Math.sqrt(a) : a, description: "Square Root" },
  [gggOps.inv]: { args: 1, fn: (a,b) => !b ? 1/a : a, description: "Inverse" },
  [gggOps.abs]: { args: 1, fn: (a,b) => !b ? Math.abs(a) : a, description: "Absolute" },
  [gggOps.ceil]: { args: 1, fn: (a,b) => !b ? Math.ceil(a) : a, description: "Ceiling" },
  [gggOps.floor]: { args: 1, fn: (a,b) => !b ? Math.floor(a) : a, description: "Floor" },
  [gggOps.round]: { args: 1, fn: (a,b) => !b ? Math.round(a) : a, description: "Round" },
  [gggOps.trunc]: { args: 1, fn: (a,b) => !b ? Math.trunc(a) : a, description: "Truncate" },
  [gggOps.sign]: { args: 1, fn: (a,b) => !b ? Math.sign(a) : a, description: "Sign" },
  [gggOps.exp]: { args: 1, fn: (a,b) => !b ? Math.exp(a) : a, description: "Exponential" },
  [gggOps.log]: { args: 1, fn: (a,b) => !b ? Math.log(a) : a, description: "Logarithm" },
  [gggOps.log10]: { args: 1, fn: (a,b) => !b ? Math.log10(a) : a, description: "Logarithm Base 10" },
  [gggOps.log2]: { args: 1, fn: (a,b) => !b ? Math.log2(a) : a, description: "Logarithm Base 2" },
  [gggOps.sin]: { args: 1, fn: (a,b) => !b ? Math.sin(a) : a, description: "Sine" },
  [gggOps.cos]: { args: 1, fn: (a,b) => !b ? Math.cos(a) : a, description: "Cosine" },
  [gggOps.tan]: { args: 1, fn: (a,b) => !b ? Math.tan(a) : a, description: "Tangent" },
  [gggOps.asin]: { args: 1, fn: (a,b) => !b ? Math.asin(a) : a, description: "Arcsine" },
  [gggOps.acos]: { args: 1, fn: (a,b) => !b ? Math.acos(a) : a, description: "Arccosine" },
  [gggOps.atan]: { args: 1, fn: (a,b) => !b ? Math.atan(a) : a, description: "Arctangent" },
  [gggOps.hypot]: { args: 2, fn: (a,b) => !b ? Math.hypot(a) : a, description: "Hypotenuse" },
  [gggOps.sinh]: { args: 1, fn: (a,b) => !b ? Math.sinh(a) : a, description: "Hyperbolic Sine" },
  [gggOps.cosh]: { args: 1, fn: (a,b) => !b ? Math.cosh(a) : a, description: "Hyperbolic Cosine" },
  [gggOps.tanh]: { args: 1, fn: (a,b) => !b ? Math.tanh(a) : a, description: "Hyperbolic Tangent" },
  [gggOps.asinh]: { args: 1, fn: (a,b) => !b ? Math.asinh(a) : a, description: "Hyperbolic Arcsine" },
  [gggOps.acosh]: { args: 1, fn: (a,b) => !b ? Math.acosh(a) : a, description: "Hyperbolic Arccosine" },
  [gggOps.atanh]: { args: 1, fn: (a,b) => !b ? Math.atanh(a) : a, description: "Hyperbolic Arctangent" },

  [gggOps.add]: { args: 2, fn: (a, b) => a + b, description: "Add" },
  [gggOps.mul]: { args: 2, fn: (a, b) => a * b, description: "Multiply" },

  [gggOps.atan2]: { args: 2, fn: (a,b) => Math.atan2(a,b), description: "Arctangent 2" },
  

  [gggOps.mid]: { args: 2, fn: (a, b) => (a + b)/2, description: "Midpoint" },
  [gggOps.min]: { args: 2, fn: (a, b) => Math.min(a,b), description: "Minimum" },
  [gggOps.max]: { args: 2, fn: (a, b) => Math.min(a,b), description: "Maximum" },

  [gggOps.or]: { args: 2, fn: (a, b) => bool(a || b) },
  [gggOps.and]: { args: 2, fn: (a, b) => bool(a && b) },
  [gggOps.xor]: { args: 2, fn: (a, b) => bool(a ^ b) },

  [gggOps.eq]: { args: 2, fn: (a, b) => bool(a === b), description: "Equal" },
  [gggOps.ne]: { args: 2, fn: (a, b) => bool(a !== b), description: "Not Equal" },
  [gggOps.lt]: { args: 2, fn: (a, b) => bool(a < b), description: "Less Than" },
  [gggOps.gt]: { args: 2, fn: (a, b) => bool(a > b), description: "Greater Than" },
  [gggOps.le]: { args: 2, fn: (a, b) => bool(a <= b), description: "Less Than or Equal" },
  [gggOps.ge]: { args: 2, fn: (a, b) => bool(a >= b), description: "Greater Than or Equal" },

  [gggOps.sub]: { args: 2, fn: (a, b) => a - b, description: "Subtract" },
  [gggOps.div]: { args: 2, fn: (a, b) => a / b, description: "Divide" },
  [gggOps.pow]: { args: 2, fn: (a, b) => a ** b, description: "Power" },
  [gggOps.mod]: { args: 2, fn: (a, b) => a % b, description: "Modulus" },

  [gggOps.rsub]: { args: 2, fn: (a,b) => b - a, description: "Reverse Subtract" },
  [gggOps.rdiv]: { args: 2, fn: (a,b) => b / a, description: "Reverse Divide" },
  [gggOps.rpow]: { args: 2, fn: (a,b) => b ** a, description: "Reverse Power" },
  [gggOps.rmod]: { args: 2, fn: (a,b) => b % a, description: "Reverse Modulus" },
})

gggOperators.code = GGG.Operator
gggOperators.name = "gggOperators"
gggOperators.description = "Operators"

export default gggOperators