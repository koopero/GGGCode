import Matrix from "../ggg/Matrix"
import {
  EnumDomainKind,
  enumDomain,
} from "../ggg/EnumRepository"
import { BlitModes } from "./Blit"
import { ggggxEncodingOptions } from "./GXLanguage"
import Operators from "./Operators"
import { FilterList, EdgeList } from "./Sample"
import { StorageTypes } from "./Storage"

export enum GGGGXEnumGroupIndex {
  MatrixRegister = 10,
  Storage = 11,
  Encoding = 12,
  Operator = 13,
  Transform = 14,
  Filter = 15,
  Edge = 16,
}

export const MatrixRegisterDomain = enumDomain(
  GGGGXEnumGroupIndex.MatrixRegister,
  "ggggx.register",
  EnumDomainKind.Reference,
  machine => machine.getRegisterList( Matrix ),
  "Live matrix register index/name pairs.",
)

export const StorageDomain = enumDomain(
  GGGGXEnumGroupIndex.Storage,
  "ggggx.storage",
  EnumDomainKind.Enum,
  StorageTypes,
  "Matrix storage representations.",
)

export const EncodingDomain = enumDomain(
  GGGGXEnumGroupIndex.Encoding,
  "ggggx.encoding",
  EnumDomainKind.Enum,
  ggggxEncodingOptions,
  "Matrix wire encodings.",
)

export const OperatorDomain = enumDomain(
  GGGGXEnumGroupIndex.Operator,
  "ggggx.operator",
  EnumDomainKind.Enum,
  Operators,
  "Scalar combine operators.",
)

export const TransformDomain = enumDomain(
  GGGGXEnumGroupIndex.Transform,
  "ggggx.transform",
  EnumDomainKind.Enum,
  BlitModes,
  "G40 transform modes.",
)

export const FilterDomain = enumDomain(
  GGGGXEnumGroupIndex.Filter,
  "ggggx.filter",
  EnumDomainKind.Enum,
  FilterList,
  "G40 per-axis sampling filters.",
)

export const EdgeDomain = enumDomain(
  GGGGXEnumGroupIndex.Edge,
  "ggggx.edge",
  EnumDomainKind.Enum,
  EdgeList,
  "G40 per-axis edge modes.",
)
