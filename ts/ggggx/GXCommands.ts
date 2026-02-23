
import { Command, GGG, Hooks } from "../ggg/Language"
import { ArgsBufferIndex, ArgsBufferRef, ArgsBufferStorage, 
  ArgsDimension, ArgsName, ArgsPosition, ArgsSize, ArgsEncoding, ArgType } from "./common"

import { MatrixListHooks } from "./MatrixList"
import { MatrixInitHooks } from "./MatrixInit"
import { MatrixWatchHooks } from "./MatrixWatch"
import { MatrixReadForNamespace } from "./MatrixRead"
import { WriteBufferHooks } from "./MatrixWrite"
import { MatrixDisplayHooks } from "./MatrixDisplay"
import { GXCommandNumbers, GXNamespace, GXNamespaceArg } from "./GXLanguage"


function GXCommandsForNamespace( namespace?: GXNamespaceArg ) {
  namespace = namespace || GXNamespace
  const { MatrixReadHooks } = MatrixReadForNamespace( namespace )
  const { code } = namespace
  const { 
    MatrixInit, 
    MatrixList,
    MatrixListResponse,
    MatrixRead, 
    MatrixWrite, 
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
        [GGG.Data]: {
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
      responds: {

      },
      ...WriteBufferHooks
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
