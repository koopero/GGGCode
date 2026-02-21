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
  EncodedZero = "Z",
  Operator = "Q",
  EncodedMinusOne = "N",
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

export type gggEncodingName = string

export enum gggHooks {
  Stack = "hookStack",
  Command = "hookCommand",
  Code = "hookCode",
  Value = "hookValue",
  EndArg = "hookEndArg",
  End = "hookEnd",
}

export type gggCommand = gggDescribed & {
  name?:string 
  [gggHooks.Stack]?: gggHookCallback
  [gggHooks.Command]?: gggHookCallback
  [gggHooks.Code]?: gggHookCallback
  [gggHooks.Value]?: gggHookCallback
  [gggHooks.EndArg]?: gggHookCallback
  [gggHooks.End]?: gggHookCallback
}



export type gggRangeAxis = {
  start:number
  end:number
  step:number
  count:number
  multiplier:number
  inclusive:boolean
}

export type gggRangeAxes = {
  axes:gggRangeAxis[]
}

export type gggNumeric = number | gggRangeAxes | gggRangeAxis

export type gggReference = {
  register: string,
  subscript: gggNumeric[],
}

export type gggValueWithEncoding = {
  value: number | string,
  encoding: gggEncodingName,
}

export type gggPrimitive = boolean | string | gggNumeric | gggValueWithEncoding | gggReference



export type gggDescribed = {
  description?: string,
}

export type gggToken = {
  code?:string
  index?:number
  row?:number
  col?:number
  len?:number
  encoding?: gggEncodingName,
  comment?:string
  command?:string
  args?:gggToken[]
  data?:gggPrimitive|gggPrimitive[]
}

export type gggParseOptions = {
  lineSizeMax?:number
}

export type gggTokenArg = string | gggToken


export type gggHookArgs = {
  machine?:any,
  command:string,
  state:{ [key:string]:any },
  code?:string,
  value?:number|string,
  arg?:gggTokenArg,
}

type gggHookCallback = ( arg:gggHookArgs ) => Promise<any> | void
export type gggCommands = { [key:string]:gggCommand }
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


export function gggCasedString( str:string ) {
  return str.toUpperCase()
}

export type ParseOptions = {
  keepEncoding?:boolean
  keepComments?:boolean
}


export type ggggxDimension = number[]
export type ggggxDimArg = number | number[]
export type ggggxVecArg = number | number[]