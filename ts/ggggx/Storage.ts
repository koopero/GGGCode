import NamedList, { NamedListItem } from "../ggg/NamedList"
import { GGG } from "../ggg/Language"
import { isDefined, isNumber, isObject, isString } from "../common/util"
import { floor, max, min } from "../common/math"

export type StorageClass = number[] | Uint8Array | Int8Array | Uint16Array | Int16Array | Uint32Array | Int32Array | Float32Array | Float64Array
export enum StorageTypeNames {
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


export type StorageProps = string | number | NamedListItem & {
  dim?: number[],
  dataClass?: any,
  norm1?: number,
  normClamp?: boolean,
  encoding?: string,
  range?: null | [number,number],
}

export type StorageType = {
  index: number,
  name: string,
  dataClass: new ( length:number ) => any,
  norm1: number,
  range: null | [number,number],
  encoding: string,
  cxxStorage: string,
}

export const StorageDefault : StorageType = { 
  index: 0, 
  name: StorageTypeNames.Default, 
  dataClass: Array, 
  encoding: GGG.Value, 
  norm1: 1, 
  range: null,
  cxxStorage: "float",
}

type RangeType = [number,number]
const RangeU8:RangeType = [0,255]
const RangeI8:RangeType = [-128,127]
const RangeU16:RangeType = [0,65535]
const RangeI16:RangeType = [-32768,32767]
const RangeU32:RangeType = [0,4294967295]
const RangeI32:RangeType = [-2147483648,2147483647]

export const StorageTypes = new NamedList<StorageType>( [
  StorageDefault,
  { index: 8, name: StorageTypeNames.UNorm8, dataClass: Uint8Array, encoding: GGG.HexNorm2, norm1: 255, range: RangeU8, cxxStorage: "uint8_t" },
  { index: 255, name: StorageTypeNames.UInt8, dataClass: Uint8Array, encoding: GGG.HexNorm2, norm1: 1, range: RangeU8, cxxStorage: "uint8_t" },
  { index: 9, name: StorageTypeNames.Norm8, dataClass: Int8Array, encoding: GGG.HexNorm2, norm1: 127, range: RangeI8, cxxStorage: "uint8_t" },
  { index: 10, name: StorageTypeNames.Int8, dataClass: Int8Array, encoding: GGG.HexNorm2, norm1: 1, range: RangeI8, cxxStorage: "int8_t" },
  { index: 11, name: StorageTypeNames.UNorm4, dataClass: Uint8Array, encoding: GGG.HexNorm2, norm1: 16, range: RangeU8, cxxStorage: "uint8_t" },
  { index: 12, name: StorageTypeNames.Norm4, dataClass: Int8Array, encoding: GGG.HexNorm2, norm1: 8, range: RangeI8, cxxStorage: "int8_t" },
] )


export function StorageFromDepth( depth:number ) {
  switch( depth ) {
    case 8: return StorageTypeNames.Norm8
  }

  return StorageTypeNames.Default
}

export function Storage( storage:StorageProps ) : StorageType {
  if ( storage as StorageType ) {
    return storage as StorageType
  }

  if ( isString( storage ) || isNumber( storage ) ) {
    storage = StorageTypes.get( storage )
  }

  storage = storage || StorageDefault

  return storage as StorageType
}

export function StorageValueNorm( storage:StorageProps, value:number ) {
  storage = Storage( storage )
  const { norm1 = 1, range = null } = storage
  let norm = value * norm1
  if ( range ) {
    norm = floor( min( max( norm, range[0] ), range[1] ) )
  }
  return norm
}

export function StorageNormValue( storage:StorageProps, norm:number ) {
  storage = Storage( storage )
  const { norm1 = 1 } = storage
  let value = norm / norm1
  return value
}