import {
  EnumDomainKind,
  enumDomain,
} from "../ggg/EnumRepository"

export enum GGGTXEnumGroupIndex {
  ProcedureRegister = 20,
}

// Marker object used as the register-class key for procedure bodies. Bodies are
// addressable by both R index and L name through the shared NamedList.
export const TProcedure = { name: "TProcedure" }

export const ProcedureRegisterDomain = enumDomain(
  GGGTXEnumGroupIndex.ProcedureRegister,
  "gggtx.procedure",
  EnumDomainKind.Reference,
  machine => machine.getRegisterList( TProcedure ),
  "Live procedure register index/name pairs.",
)
