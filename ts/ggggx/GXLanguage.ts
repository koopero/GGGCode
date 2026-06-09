import { GGG, CommandConvention as CC, HexEncodings } from "../ggg/Language"
import { MachineLimits } from "../ggg/Machine"
import NamedList, { NamedListItem } from "../ggg/NamedList"
import { Dimensions } from "../ggg/Language"



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
  maxDim?: Dimensions,
  maxSize?: number,
  maxBuffers?: number,
}


export const ggggxEncodingOptions = new NamedList<ggggxEncodingMeta>( [
  { index: 0, name: GGG.Value, description: "Decimal", encoding: GGG.Value },
  { index: 8, name: `0${HexEncodings.HexNorm2}`, description: "HexNorm2", encoding: HexEncodings.HexNorm2 },
  { index: 4, name: `0${HexEncodings.HexNorm1}`, description: "HexNorm1", encoding: HexEncodings.HexNorm1 },
])

export enum GXFails {
  BufferNotFound = "Buffer not found.",
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

export enum GXCommandNumbers {
  MatrixList = CC.List,
  MatrixListResponse = CC.ListResponse,
  MatrixInit = CC.Init,
  MatrixRead = CC.Read,
  MatrixWrite = CC.Write,
  MatrixBlit = CC.Blit,
  MatrixDisplay = CC.Display,
  MatrixWatch = CC.Watch,
}

export type NamespaceIndexes = {
  MatrixList?: number,
  MatrixInit?: number,
  MatrixRead?: number,
  MatrixWrite?: number,
  MatrixBlit?: number,
  MatrixDisplay?: number,
  MatrixWatch?: number,
  MatrixListResponse?: number,
}

export const GXCode = "G"

export type GXNamespaceArg = {
  code: string,
  index?: NamespaceIndexes,
}

export const GXNamespace = {
  code: GXCode,
  index: GXCommandNumbers,
}

export enum MatrixEvents {
  Resize = "resize",
  RegionChange = "regionChange",
  Display = "display",
}

export enum GXCommandNames {
  MatrixList = `${GXCode}${GXCommandNumbers.MatrixList}`,
  MatrixListResponse = `${GXCode}${GXCommandNumbers.MatrixListResponse}`,
  MatrixInit = `${GXCode}${GXCommandNumbers.MatrixInit}`,
  MatrixRead = `${GXCode}${GXCommandNumbers.MatrixRead}`,
  MatrixWrite = `${GXCode}${GXCommandNumbers.MatrixWrite}`,
  MatrixBlit = `${GXCode}${GXCommandNumbers.MatrixBlit}`,
  MatrixDisplay = `${GXCode}${GXCommandNumbers.MatrixDisplay}`,
  MatrixWatch = `${GXCode}${GXCommandNumbers.MatrixWatch}`,
}