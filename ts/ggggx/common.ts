import { GXCommandNames, ggggxEncodingOptions } from "./GXLanguage"
import { StorageTypes } from "./Storage"
import { ArgType } from "../ggg/Language"

export const ArgsBuffer = {
  description: "Buffer index.",
  type: ArgType.Any,
}

export const ArgsBufferIndex = {
  description: "buffer index.",
  type: ArgType.Number,
  format: "(n)",
}

export const ArgsBufferRef = {
  description: "buffer specifier",
  type: ArgType.Any,
  format: "(n|S)",
}

export const ArgsName = {
  description: "buffer name.",
  type: ArgType.String,
  format: "(S)",
}

export const ArgsBufferStorage = {
  description: "storage type",
  type: ArgType.String,
  options: StorageTypes,
}

// Canonical buffer axis order, innermost -> outermost. C = components/channels
// (stride-1; buffers are component-interleaved, e.g. RGBA RGBA ...), then spatial
// X, Y, Z. Coordinates and dimensions are read in this order: coord[0] is the
// component index, and dim[0] === components(). The same order is used by both
// engines' DimOffset/DimIndex math.
export const GXAxisOrder = "(C,X,Y,Z)"

export const ArgsPosition = {
  description: "Buffer position (component-first).",
  format: GXAxisOrder,
  type: ArgType.Number,
}

export const ArgsDimension = {
  description: "dimensions (component-first)",
  type: ArgType.Number,
  format: GXAxisOrder,
}

export const ArgsSize = {
  description: "Size",
  format: "(n)",
  type: ArgType.Number,
}

export const ArgsEncoding = {
  description: "string encoding",
  options: ggggxEncodingOptions,
} 
