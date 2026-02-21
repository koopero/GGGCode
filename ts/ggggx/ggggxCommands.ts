export enum gggType {
  Number = "number",
  String = "string",
  Any = "any",
}

import { GGG } from "../ggg/gggLang"
import { ggggxCodes, ggggxEncodingOptions } from "./ggggxLang"
import { StorageTypes } from "./Storage"

const ArgsBuffer = {
  description: "Buffer index.",
  type: gggType.Any,
}

const ArgsBufferIndex = {
  description: "buffer index.",
  type: gggType.Number,
  format: "(n)",
}

const ArgsBufferRef = {
  description: "buffer specifier",
  type: gggType.Any,
  format: "(n|S)",
}

const ArgsName = {
  description: "buffer name.",
  type: gggType.String,
  format: "(S)",
}

const ArgsBufferStorage = {
  description: "storage type",
  type: gggType.String,
  options: StorageTypes,
}

const ArgsPosition = {
  description: "Buffer position.",
  format: "(X,Y,Z,W)",
  type: gggType.Number,
}

const ArgsDimension = {
  description: "dimensions",
  type: gggType.Number,
  format: "(W,X,Y,Z)",
}

const ArgsSize = {
  description: "Size",
  format: "(n)",
  type: gggType.Number,
}

const ArgsEncoding = {
  description: "string encoding",
  options: ggggxEncodingOptions,
} 

import { WriteBufferHooks, MatrixReadHooks, ListBuffersHooks, MatrixInitHooks, DisplayHooks, MatrixDumpHooks, MatrixWatchHooks } from "./ggggxHooks"

const ggggxCommands = {
  [ggggxCodes.ListBuffers]: {
    description: "List buffers",
    ...ListBuffersHooks,
  },
  [ggggxCodes.NumbersInit]: {
    description: "Init buffer",
    args: {
      [GGG.Register]: ArgsBufferIndex,
      [GGG.Storage]: ArgsBufferStorage,
      [GGG.Size]: ArgsDimension,
      [GGG.Alias]: ArgsName,
    },
    ...MatrixInitHooks,
  },
  [ggggxCodes.WriteBuffer]: {
    description: "Write to buffer.",
    args: {
      [GGG.Register]: ArgsBufferRef,
      [GGG.Offset]: ArgsPosition,
      [GGG.Data]: {
        description: "Values to write.",
        type: gggType.Number,
        format: "(n+)",
      },
    },
    ...WriteBufferHooks
  },
  [ggggxCodes.ReadBuffer]: {
    description: "Read from buffer.",
    args: {
      [GGG.Register]: ArgsBufferRef,
      [GGG.Offset]: ArgsPosition,
      [GGG.Size]: ArgsSize,
      [GGG.Encoding]: ArgsEncoding,
    },
    ...MatrixReadHooks,
  },
  [ggggxCodes.Display]: {
    description: "Export frame.",
    args: {
      [GGG.Register]: ArgsBufferRef,
      [GGG.Offset]: ArgsPosition,
      [GGG.Size]: ArgsDimension,
    },
    ...DisplayHooks
  },
  [ggggxCodes.MatrixDump]: {
    description: "Dump buffer.",
    args: {
      [GGG.Register]: ArgsBufferRef,
      [GGG.Encoding]: ArgsEncoding,
    },
    ...MatrixDumpHooks
  },
  [ggggxCodes.WatchBuffers]: {
    description: "Watch buffer.",
    args: {
      [GGG.Encoding]: ArgsEncoding,
      [GGG.Register]: ArgsBufferRef,
    },
    ...MatrixWatchHooks
  },
}

export default ggggxCommands
