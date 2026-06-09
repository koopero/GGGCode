
import { Command, GGG, Hooks } from "../ggg/Language"
import { ArgsBufferIndex, ArgsBufferRef, ArgsBufferStorage, 
  ArgsDimension, ArgsName, ArgsPosition, ArgsSize, ArgsEncoding } from "./common"
import { ArgType } from "../ggg/Language"

import { MatrixListForNamespace } from "./MatrixList"
import { MatrixInitHooks } from "./MatrixInit"
import { MatrixWatchHooks } from "./MatrixWatch"
import { MatrixReadForNamespace } from "./MatrixRead"
import { MatrixDisplayHooks } from "./MatrixDisplay"
import { GXCommandNumbers, GXNamespace, GXNamespaceArg } from "./GXLanguage"
import { MatrixWriteHooks } from "./MatrixWrite"
import { MatrixBlitHooks } from "./MatrixBlit"


function GXCommandsForNamespace( namespace?: GXNamespaceArg ) {
  namespace = namespace || GXNamespace
  const { MatrixReadHooks } = MatrixReadForNamespace( namespace )
  const { MatrixListHooks } = MatrixListForNamespace( namespace )
  const { code } = namespace
  const {
    MatrixInit,
    MatrixList,
    MatrixListResponse,
    MatrixRead,
    MatrixWrite,
    MatrixBlit,
    MatrixDisplay,
    MatrixWatch
  } = namespace.index || GXCommandNumbers
  const commands : Record<string, Command> = {}


  if ( MatrixList ) {
    commands[ `${code}${MatrixList}` ] = {
      description: "List buffers",
      responds: {
        [`${code}${MatrixListResponse}`]: "Matrix rows listed.",
        "OK": "Buffers listed successfully.",
      },
      ...MatrixListHooks,
    }
  }

  if ( MatrixInit ) {
    commands[ `${code}${MatrixInit}` ] = {
      description: "Init buffer",
      args: {
        [GGG.Register]: ArgsBufferIndex,
        [GGG.Storage]: ArgsBufferStorage,
        [GGG.Size]: ArgsDimension,
        [GGG.Alias]: ArgsName,
      },
      ...MatrixInitHooks,
    }
  }

  if ( MatrixRead ) {
    commands[ `${code}${MatrixRead}` ] = {
      description: "Read from buffer.",
      args: {
        [GGG.Register]: ArgsBufferRef,
        [GGG.Encoding]: ArgsEncoding,
        [GGG.Offset]: ArgsPosition,
        [GGG.Size]: ArgsSize,
      },
      ...MatrixReadHooks,
    }
  }

  if ( MatrixDisplay ) {
    commands[ `${code}${MatrixDisplay}` ] = {
      description: "Display buffer.",
      args: {
        [GGG.Register]: ArgsBufferRef,
        [GGG.Encoding]: ArgsEncoding,
        [GGG.Offset]: ArgsPosition,
        [GGG.Size]: ArgsSize,
      },
      ...MatrixDisplayHooks,
    }
  }

  if ( MatrixWrite ) {
    commands[ `${code}${MatrixWrite}` ] = {
      description: "Write to buffer.",
      args: {
        [GGG.Register]: ArgsBufferRef,
        [GGG.Offset]: ArgsPosition,
        [GGG.Value]: {
          description: "Values to write.",
          type: ArgType.Number,
          format: "(n+)",
        },
        [GGG.Operator]: {
          description: "Write operator.",
          type: ArgType.String,
        },
        ["F"]: {
          description: "Fill size",
          type: ArgType.Number,
        }
      },

      ...MatrixWriteHooks
    }
    
  }

  if ( MatrixBlit ) {
    commands[ `${code}${MatrixBlit}` ] = {
      description: "Blit (transform-copy) between buffers.",
      args: {
        [GGG.Register]: ArgsBufferRef,
        [GGG.Target]: {
          description: "Destination buffer (index or name).",
          type: ArgType.Any,
        },
        [GGG.Transform]: {
          description: "Transform coefficients (per mode): box = source min,max pairs; map = (srcAxis,min,max) triples per dest axis; affine = matrix.",
          type: ArgType.Number,
          format: "(n+)",
        },
        [GGG.Storage]: {
          description: "Transform mode: box (default) / affine / map (index or name).",
          type: ArgType.Any,
        },
        [GGG.Offset]: ArgsPosition,
        [GGG.Size]: ArgsSize,
        [GGG.Dimension]: ArgsDimension,
        [GGG.Operator]: {
          description: "Combine operator into the destination cell.",
          type: ArgType.String,
        },
        [GGG.Failure]: {
          description: "Per-axis combine op (list, continue-last): 0 linear / 1 nearest / 2 min / 3 max / 4 add.",
          type: ArgType.Any,
          format: "(*)",
        },
        [GGG.Encoding]: {
          description: "Per-axis edge (list, continue-last): 0 loop / 1 hold / 2 mirror / 3 zero.",
          type: ArgType.Any,
          format: "(*)",
        },
      },
      ...MatrixBlitHooks,
    }
  }

  if ( MatrixWatch ) {
    commands[ `${code}${MatrixWatch}` ] = {
      description: "Watch buffer.",
      args: {
        [GGG.Register]: ArgsBufferRef,
        [GGG.Encoding]: ArgsEncoding,
        [GGG.Offset]: ArgsPosition,
        [GGG.Size]: ArgsSize,
      },
      ...MatrixWatchHooks,
    }
  }

  return commands
}

const GXCommands = GXCommandsForNamespace()
export { GXCommands }
