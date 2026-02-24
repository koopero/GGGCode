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

export const ArgsPosition = {
  description: "Buffer position.",
  format: "(X,Y,Z,W)",
  type: ArgType.Number,
}

export const ArgsDimension = {
  description: "dimensions",
  type: ArgType.Number,
  format: "(W,X,Y,Z)",
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
