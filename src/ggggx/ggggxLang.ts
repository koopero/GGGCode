import { GGG, gggCommandConvention } from "../ggg/gggLang"
import gggNamedList, { gggNamedListItem } from "../ggg/gggNamedList"



export type ggggxDimension = number[]
export type ggggxDimArg = number | number[]
export type ggggxVecArg = number | number[]

export const ggggxPrefix = "G"

export enum ggggxCodes {
  ListBuffers = `${ggggxPrefix}${gggCommandConvention.List}`,
  NumbersInit = `${ggggxPrefix}${gggCommandConvention.Init}`,
  WriteBuffer = `${ggggxPrefix}${gggCommandConvention.Write}`,
  ReadBuffer = `${ggggxPrefix}${gggCommandConvention.Read}`,
  ReadBufferResponse = `${ggggxPrefix}${gggCommandConvention.ReadResponse}`,
  MatrixDump = `${ggggxPrefix}${gggCommandConvention.Output}`,
  WatchBuffers = `${ggggxPrefix}${gggCommandConvention.Watch}`,
  Display = `${ggggxPrefix}${gggCommandConvention.Display}`,
}


type ggggxEncodingMeta =  {
  index: number,
  name: string,
  description: string,
  encoding?: string,
}

export const ggggxEncodingOptions = new gggNamedList<ggggxEncodingMeta>( [
  { index: 0, name: GGG.Value, description: "Decimal", encoding: GGG.Value },
  { index: 8, name: `0${GGG.HexNorm2}`, description: "HexNorm2", encoding: GGG.HexNorm2 },
  { index: 4, name: `0${GGG.HexNorm2}`, description: "HexNorm1", encoding: GGG.HexNorm1 },
])


export enum ggggxFails {
  BufferNotFound = "Buffer not found.",
}


export enum ggggxEvents {
  Resize = "resize",
  RegionChange = "regionChange",
  Display = "display",
}



type ggggxLimitBuffer = boolean | number | string | number[] | string[]
type ggggxLimits = {
  canCreate?: ggggxLimitBuffer,
  canResize?: ggggxLimitBuffer,
  canRead?: ggggxLimitBuffer,
  canWrite?: ggggxLimitBuffer,
  canWatch?: ggggxLimitBuffer,
  maxDim?: ggggxDimension,
  maxSize?: number,
  maxBuffers?: number,
}


export enum Filter {
  Linear = "linear",
  Nearest = "nearest",
}

export enum Edge {
  Hold = "hold",
  Repeat = "repeat",
  Mirror = "mirror",
  Zero = "zero",
}

export enum Coord {
  Normalized = "normalized",
  Pixel = "pixel",
  Fence = "fence",
}

const GGGGX = {
  ...ggggxCodes
}

export default GGGGX