import NamedList from "./NamedList"

export enum GGG {
  Data = "A",
  Command = "B",
  Code = "C",
  Argument = "U",
  End = "\n",
  Skip = "?",
  EndArgument = " ",
  Comment = ";",
  Failure = "F",
  Value = "V",
  Size = "S",
  Offset = "P",
  Zero = "0",
  Number = "+",
  HexNumber = "X",
  HexFraction = "Y",
  HexList1 = "I",
  HexList2 = "G",
  HexNorm1 = "J",
  HexNorm2 = "H",
  EncodedOne = "K",
  Operator = "Q",
  Alias = "L",
  StringToEOL = "`",
  Dimension = "D",
  Encoding = "E",
  Storage = "T",
  Quote = "\"",
  Comma = ",",
  Period = ".",
  Register = "R",
  Reference = "$",
  Range = ":",
  Uninclusive = ">",
  Multiplier = "*",
  Count = "/",
  Okay = "O",
  Escape = "\\",
  Subscript = "[",
  SubscriptEnd = "]",
  NextAxis = "|",
}

export type EncodingName = string

export enum UnitaryNames {
  Zero = "Z",
  One = "K",
  MinusOne = "N",
  Pi = "π",
  TwoPi = "τ",
  Euler = "e",
  GoldenRatio = "φ",
  EulerMascheroni = "γ",
}

export const UnitaryValues = {
  [UnitaryNames.Zero]: 0,
  [UnitaryNames.One]: 1,
  [UnitaryNames.MinusOne]: -1,
  [UnitaryNames.Pi]: Math.PI,
  [UnitaryNames.TwoPi]: Math.PI * 2,
  [UnitaryNames.Euler]: Math.E,
  [UnitaryNames.GoldenRatio]: (1 + Math.sqrt(5)) / 2,
  [UnitaryNames.EulerMascheroni]: 0.5772156649,
}


export enum Hooks {
  Stack = "hookStack",
  Command = "hookCommand",
  Code = "hookCode",
  Value = "hookValue",
  EndArg = "hookEndArg",
  End = "hookEnd",
}

export type CommandArgDescribed = {
  description?: string,
  required?: boolean,
  type?: ArgType,
  format?: string,
  options?: NamedList<any>,
}

export type ResponseDescribed = string | {
  description?: string,
}

export type CommandDescribed = Described & {
  name?:string 
  description?: string,
  args?: { [key:string]: CommandArgDescribed },
  responds?: { [key:string]: ResponseDescribed },
}

export type Command = CommandDescribed & {
  [Hooks.Stack]?: HookCallback
  [Hooks.Command]?: HookCallback
  [Hooks.Code]?: HookCallback
  [Hooks.Value]?: HookCallback
  [Hooks.EndArg]?: HookCallback
  [Hooks.End]?: HookCallback
}



export type RangeAxis = {
  start:number
  end:number
  step:number
  count:number
  multiplier:number
  inclusive:boolean
}

export type RangeAxes = {
  axes:RangeAxis[]
}

export type Numeric = number | RangeAxes | RangeAxis

export type Reference = {
  register: string,
  subscript: Numeric[],
}

export type ValueWithEncoding = {
  value: number | string,
  encoding: EncodingName,
}

export type Primitive = boolean | string | Numeric | ValueWithEncoding | Reference

export type Described = {
  description?: string,
}

export type Token = {
  code?:string
  index?:number
  row?:number
  col?:number
  len?:number
  encoding?: EncodingName,
  comment?:string
  command?:string
  args?:Token[]
  data?:Primitive|Primitive[]
}

export type ParseOptions = {
  lineSizeMax?:number
  keepEncoding?:boolean
  keepComments?:boolean
}

export type TokenArg = string | Token


export type HookArgs = {
  machine?:any,
  command:string,
  state:{ [key:string]:any },
  code?:string,
  value?:number|string,
  arg?:TokenArg,
}

type HookCallback = ( arg:HookArgs ) => Promise<any> | void
export type Commands = { [key:string]:Command }
export enum CommandConvention {
  List = 1,
  Init = 30,
  Write = 20,
  Read = 10,
  ReadResponse = -CommandConvention.Read,
  ListResponse = -CommandConvention.List,
  Output = 15,
  Watch = 25,
  Display = 13,
  DisplayResponse = -CommandConvention.Display,
}


export function CasedString( str:string ) {
  return str.toUpperCase()
}

export type Dimensions = number[]
export type DimArg = number | number[]
export type VecArg = number | number[]

export enum ArgType {
  Number = "number",
  String = "string",
  Any = "any",
}
