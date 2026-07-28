import { ArgType } from "../ggg/Language"
import { EncodingDomain, MatrixRegisterDomain, StorageDomain } from "./Domains"

export const ArgsBuffer = {
  description: "Buffer index.",
  domain: MatrixRegisterDomain,
}

export const ArgsBufferIndex = {
  description: "buffer index.",
  type: ArgType.Number,
}

export const ArgsBufferRef = {
  description: "buffer specifier",
  domain: MatrixRegisterDomain,
}

export const ArgsName = {
  description: "buffer name.",
  type: ArgType.String,
}

export const ArgsBufferStorage = {
  description: "storage type",
  domain: StorageDomain,
}

// Canonical buffer axis order, innermost -> outermost. C = components/channels
// (stride-1; buffers are component-interleaved, e.g. RGBA RGBA ...), then spatial
// X, Y, Z. Coordinates and dimensions are read in this order: coord[0] is the
// component index, and dim[0] === components(). The same order is used by both
// engines' DimOffset/DimIndex math.
export const GXAxisOrder = "comma-list:axes=C,X,Y,Z"

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
  type: ArgType.Number,
}

export const ArgsEncoding = {
  description: "string encoding",
  domain: EncodingDomain,
} 
