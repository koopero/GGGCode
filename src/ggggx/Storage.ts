import gggNamedList, { gggNamedListItem } from "../ggg/gggNamedList"
import { GGG } from "../ggg/gggLang"
import { isDefined, isNumber, isObject, isString } from "../common/util"
import { floor, max, min } from "../common/math"

export type StorageClass = number[] | Uint8Array | Int8Array | Uint16Array | Int16Array | Uint32Array | Int32Array | Float32Array | Float64Array
export enum ggggxStorageTypeNames {
  Default = "Array",
  UNorm2 = "UNorm2", Norm2 = "Norm2",
  UNorm4 = "UNorm4", Norm4 = "Norm4",
  UNorm6 = "UNorm6", Norm6 = "Norm6",
  UNorm8 = "UNorm8", Norm8 = "Norm8",
  UNorm12 = "UNorm12", Norm12 = "Norm12",
  UNorm14 = "UNorm14", Norm14 = "Norm14",
  UNorm16 = "UNorm16", Norm16 = "Norm16",
  UInt8 = "Uint8", Int8 = "Int8",
}


export type ggggxStorageProps = string | number | gggNamedListItem & {
  dim?: number[],
  dataClass?: any,
  norm1?: number,
  normClamp?: boolean,
  encoding?: string,
  range?: null | [number,number],
}

export type ggggxStorageType = {
  index: number,
  name: string,
  dataClass: new ( length:number ) => any,
  norm1: number,
  range: null | [number,number],
  encoding: string,
  cppStorage: string,
}

export const StorageDefault : ggggxStorageType = { 
  index: 0, 
  name: ggggxStorageTypeNames.Default, 
  dataClass: Array, 
  encoding: GGG.Value, 
  norm1: 1, 
  range: null,
  cppStorage: "float",
}

type RangeType = [number,number]
const RangeU8:RangeType = [0,255]
const RangeI8:RangeType = [-128,127]
const RangeU16:RangeType = [0,65535]
const RangeI16:RangeType = [-32768,32767]
const RangeU32:RangeType = [0,4294967295]
const RangeI32:RangeType = [-2147483648,2147483647]

export const ggggxStorageTypes = new gggNamedList<ggggxStorageType>( [
  StorageDefault,
  { index: 8, name: ggggxStorageTypeNames.UNorm8, dataClass: Uint8Array, encoding: GGG.HexNorm2, norm1: 255, range: RangeU8, cppStorage: "uint8_t" },
  { index: 255, name: ggggxStorageTypeNames.UInt8, dataClass: Uint8Array, encoding: GGG.HexNorm2, norm1: 1, range: RangeU8, cppStorage: "uint8_t" },
  { index: 9, name: ggggxStorageTypeNames.Norm8, dataClass: Int8Array, encoding: GGG.HexNorm2, norm1: 127, range: RangeI8, cppStorage: "uint8_t" },
  { index: 10, name: ggggxStorageTypeNames.Int8, dataClass: Int8Array, encoding: GGG.HexNorm2, norm1: 1, range: RangeI8, cppStorage: "int8_t" },
  { index: 11, name: ggggxStorageTypeNames.UNorm4, dataClass: Uint8Array, encoding: GGG.HexNorm2, norm1: 16, range: RangeU8, cppStorage: "uint8_t" },
  { index: 12, name: ggggxStorageTypeNames.Norm4, dataClass: Int8Array, encoding: GGG.HexNorm2, norm1: 8, range: RangeI8, cppStorage: "int8_t" },
] )


export function StorageFromDepth( depth:number ) {
  switch( depth ) {
    case 8: return ggggxStorageTypeNames.Norm8
  }

  return ggggxStorageTypeNames.Default
}

export function Storage( storage:ggggxStorageProps ) : ggggxStorageType {
  if ( storage as ggggxStorageType ) {
    return storage as ggggxStorageType
  }

  if ( isString( storage ) || isNumber( storage ) ) {
    storage = ggggxStorageTypes.get( storage )
  }

  storage = storage || StorageDefault

  return storage as ggggxStorageType
}

export function StorageValueNorm( storage:ggggxStorageProps, value:number ) {
  storage = Storage( storage )
  const { norm1 = 1, range = null } = storage
  let norm = value * norm1
  if ( range ) {
    norm = floor( min( max( norm, range[0] ), range[1] ) )
  }
  return norm
}

export function StorageNormValue( storage:ggggxStorageProps, norm:number ) {
  storage = Storage( storage )
  const { norm1 = 1 } = storage
  let value = norm / norm1
  return value
}