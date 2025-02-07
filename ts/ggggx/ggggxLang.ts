import { GGG, CommandConvention } from "../ggg/gggLang"
import { MachineLimits } from "../ggg/Machine"
import gggNamedList, { gggNamedListItem } from "../ggg/gggNamedList"


export type ggggxDimension = number[]
export type ggggxDimArg = number | number[]
export type ggggxVecArg = number | number[]

type ggggxEncodingMeta =  {
  index: number,
  name: string,
  description: string,
  encoding?: string,
}

type MatrixLimitsFilter = boolean | number | string | number[] | string[]
export type MatrixLimits = MachineLimits & {
  canCreate?: MatrixLimitsFilter,
  canResize?: MatrixLimitsFilter,
  canRead?: MatrixLimitsFilter,
  canWrite?: MatrixLimitsFilter,
  canWatch?: MatrixLimitsFilter,
  maxDim?: ggggxDimension,
  maxSize?: number,
  maxBuffers?: number,
}




export const ggggxPrefix = "G"

export enum ggggxCodes {
  ListBuffers = `${ggggxPrefix}${CommandConvention.List}`,
  NumbersInit = `${ggggxPrefix}${CommandConvention.Init}`,
  WriteBuffer = `${ggggxPrefix}${CommandConvention.Write}`,
  ReadBuffer = `${ggggxPrefix}${CommandConvention.Read}`,
  ReadBufferResponse = `${ggggxPrefix}${CommandConvention.ReadResponse}`,
  MatrixDump = `${ggggxPrefix}${CommandConvention.Output}`,
  WatchBuffers = `${ggggxPrefix}${CommandConvention.Watch}`,
  Display = `${ggggxPrefix}${CommandConvention.Display}`,
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