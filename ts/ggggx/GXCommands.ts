
import { Command, GGG } from "../ggg/Language"
import { ArgsBufferRef, ArgsBufferStorage,
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
import {
  ArgumentKind,
} from "../ggg/EnumRepository"
import {
  EdgeDomain,
  FilterDomain,
  MatrixRegisterDomain,
  OperatorDomain,
  TransformDomain,
} from "./Domains"


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
        [GGG.Register]: ArgsBufferRef,
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
      responds: {
        ...( MatrixWrite ? { [`${code}${MatrixWrite}`]: "Replayable buffer write." } : {} ),
        "OK": "Buffer read successfully.",
      },
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
      description: "Emit the whole buffer to the host display.",
      responds: {
        "OK": "Display event emitted.",
      },
      args: {
        [GGG.Register]: ArgsBufferRef,
      },
      ...MatrixDisplayHooks,
    }
  }

  if ( MatrixWrite ) {
    commands[ `${code}${MatrixWrite}` ] = {
      description: "Write to buffer.",
      examples: [
        { source: "GK", description: "Repeat to size." },
      ],
      args: {
        [GGG.Register]: ArgsBufferRef,
        [GGG.Offset]: ArgsPosition,
        [GGG.Value]: {
          description: "Values to write.",
          type: ArgType.Number,
          format: "comma-list:number;one-or-more",
        },
        [GGG.Operator]: {
          description: "Write operator.",
          domain: OperatorDomain,
        },
        [GGG.Repeat]: {
          description: "Repeat values to size.",
          kind: ArgumentKind.Boolean,
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
          domain: MatrixRegisterDomain,
        },
        [GGG.Transform]: {
          description: "Transform coefficients (per mode): box = source min,max pairs; map = (srcAxis,min,max) triples per dest axis; affine = matrix; offset = source pixel offsets.",
          type: ArgType.Number,
          format: "comma-list:number;one-or-more",
        },
        [GGG.Storage]: {
          description: "Transform mode: box (default) / affine / map / offset (index or name).",
          domain: TransformDomain,
        },
        [GGG.Offset]: ArgsPosition,
        [GGG.Size]: ArgsSize,
        [GGG.Dimension]: ArgsDimension,
        [GGG.Operator]: {
          description: "Combine operator into the destination cell.",
          domain: OperatorDomain,
        },
        [GGG.Failure]: {
          description: "Per-axis filter (list, continue-last): 0 linear / 1 nearest / 2 mean / 3 min / 4 max / 5 add.",
          domain: FilterDomain,
          format: "comma-list:enum;continue-last",
        },
        [GGG.Encoding]: {
          description: "Per-axis edge (list, continue-last): 0 loop / 1 hold / 2 mirror / 3 zero.",
          domain: EdgeDomain,
          format: "comma-list:enum;continue-last",
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
