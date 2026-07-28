import NamedList, { NamedListItem } from "./NamedList"
import { ArgType, GGGFail } from "./Language"

// Stable enum-group indexes owned by the core language. Extensions own their
// own allocations; the C++ generator combines them into one wire enum.
export enum GGGEnumGroupIndex {
  EnumGroup = 0,
  ArgumentKind = 3,
  EnumDomainKind = 4,
  Failure = 5,
}

// Semantic kind of a command argument. "data" is the honest fallback for old
// metadata that constrains neither its scalar type nor a named domain.
export enum ArgumentKind {
  Data = 0,
  Number = 1,
  String = 2,
  Boolean = 3,
  Enum = 4,
  Reference = 5,
}

export enum EnumDomainKind {
  Enum = 0,
  Reference = 1,
}

export const enumValueNames = {
  [ArgumentKind.Data]: "data",
  [ArgumentKind.Number]: "number",
  [ArgumentKind.String]: "string",
  [ArgumentKind.Boolean]: "boolean",
  [ArgumentKind.Enum]: "enum",
  [ArgumentKind.Reference]: "reference",
} as const

export const enumDomainKindNames = {
  [EnumDomainKind.Enum]: "enum",
  [EnumDomainKind.Reference]: "reference",
} as const

export type EnumValue = NamedListItem & {
  description?: string,
}

export type EnumValuesProvider =
  NamedList<any> |
  (( machine:any ) => NamedList<any>)

export type EnumDomain = NamedListItem & {
  index: number,
  name: string,
  description?: string,
  kind: EnumDomainKind,
  values: EnumValuesProvider,
}

export function enumValues( values:EnumValue[] ) {
  return new NamedList<EnumValue>( values )
}

export function enumDomain(
  index:number,
  name:string,
  kind:EnumDomainKind,
  values:EnumValuesProvider,
  description = "",
): EnumDomain {
  return { index, name, kind, values, description }
}

export function valuesForDomain( domain:EnumDomain, machine:any ): NamedList<any> {
  return typeof domain.values === "function" ? domain.values( machine ) : domain.values
}

export function enumName( list:NamedList<NamedListItem>, value:string|number, fallback = "" ) {
  return list.get( value )?.name ?? fallback
}

export const EnumGroupDomain = enumDomain(
  GGGEnumGroupIndex.EnumGroup,
  "EnumGroup",
  EnumDomainKind.Reference,
  machine => machine.enumDomains,
  "Enum groups available on this machine.",
)

export const ArgumentKindDomain = enumDomain(
  GGGEnumGroupIndex.ArgumentKind,
  "ArgumentKind",
  EnumDomainKind.Enum,
  enumValues( Object.entries( enumValueNames ).map( ( [ index, name ] ) => ( {
    index: Number( index ),
    name,
  } ) ) ),
  "Semantic command argument kinds.",
)

export const EnumDomainKindDomain = enumDomain(
  GGGEnumGroupIndex.EnumDomainKind,
  "EnumDomainKind",
  EnumDomainKind.Enum,
  enumValues( Object.entries( enumDomainKindNames ).map( ( [ index, name ] ) => ( {
    index: Number( index ),
    name,
  } ) ) ),
  "Whether a named domain is a fixed enum or a live reference table.",
)

export const FailureDomain = enumDomain(
  GGGEnumGroupIndex.Failure,
  "ggg.failure",
  EnumDomainKind.Enum,
  enumValues(
    Object.entries( GGGFail )
      .filter( ( [ name, value ] ) => typeof value === "number" && isNaN( Number( name ) ) )
      .map( ( [ name, value ] ) => ( { index: value as number, name } ) ),
  ),
  "Failure codes carried by the universal F argument.",
)

export const GGGEnumDomains = [
  EnumGroupDomain,
  ArgumentKindDomain,
  EnumDomainKindDomain,
  FailureDomain,
]

export function argumentKind( arg:{ kind?:ArgumentKind, type?:ArgType, domain?:EnumDomain } ) {
  if ( arg.kind !== undefined ) return arg.kind
  if ( arg.domain ) {
    return arg.domain.kind === EnumDomainKind.Reference
      ? ArgumentKind.Reference
      : ArgumentKind.Enum
  }
  switch ( arg.type ) {
    case ArgType.Number: return ArgumentKind.Number
    case ArgType.String: return ArgumentKind.String
    default: return ArgumentKind.Data
  }
}
