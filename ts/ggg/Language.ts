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
  Repeat = "G",
  Zero = "0",
  Number = "+",
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

export enum HexEncodings {
  HexNumber = "X",
  HexFraction = "Y",
  HexList1 = "I",
  HexList2 = "G",
  HexNorm1 = "J",
  HexNorm2 = "H",
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

// Decision returned by a control frame's Stack hook once a command is
// formalized (its name is known). Run dispatches normally; Capture appends the
// line's raw source to the frame body without dispatching; Skip consumes and
// discards the line; Error emits O0 and consumes the line. A frame that returns
// nothing is treated as Run. Mirrored hand-written in C++ (CommandDecision).
export enum CommandDecision {
  Run = "run",
  Capture = "capture",
  Skip = "skip",
  Error = "error",
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
  source?:string
  eol?:boolean   // a complete output line; Format terminates it with a newline
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
  frame?:any,
}

type HookCallback = ( arg:HookArgs ) => Promise<any> | CommandDecision | void
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
