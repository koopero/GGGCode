import { CommandDescribed, GGG } from "../ggg/Language"
import {
  ArgumentKind,
  ArgumentKindDomain,
  EnumDomainKind,
  EnumDomainKindDomain,
  EnumGroupDomain,
  GGGEnumDomains,
  enumDomain,
  enumValues,
} from "../ggg/EnumRepository"

// Enum-group indexes owned by gggdx.
export enum GGGDXEnumGroupIndex {
  CommandResultRecord = 1,
  EnumResultRecord = 2,
  MessageKind = 6,
  BasicsResultRecord = 7,
  GrammarRuleKind = 8,
  GrammarExampleKind = 9,
  ControlResultRecord = 17,
}

export enum MessageKind {
  Command = 0,
  Result = 1,
}

export const messageKindNames = {
  [MessageKind.Command]: "command",
  [MessageKind.Result]: "result",
} as const

export enum BasicsResultRecord {
  Rule = -20,
  Example = -21,
}

export enum GrammarRuleKind {
  Delimiter = 0,
  Form = 1,
  Constraint = 2,
  Control = 3,
}

export const grammarRuleKindNames = {
  [GrammarRuleKind.Delimiter]: "delimiter",
  [GrammarRuleKind.Form]: "form",
  [GrammarRuleKind.Constraint]: "constraint",
  [GrammarRuleKind.Control]: "control",
} as const

export enum GrammarExampleKind {
  Valid = 0,
  Invalid = 1,
}

export const grammarExampleKindNames = {
  [GrammarExampleKind.Valid]: "valid",
  [GrammarExampleKind.Invalid]: "invalid",
} as const

// Command-catalog result records. These are the actual signed D command values
// published through D5, not positive surrogates.
export enum CommandResultRecord {
  Command = -40,
  Argument = -41,
  Return = -42,
  Example = -45,
}

// Enum-catalog result records.
export enum EnumResultRecord {
  Group = -50,
  Entry = -51,
}

// UI-control result records.
export enum ControlResultRecord {
  Description = -60,
}

// D request numbers are bootstrap vocabulary. Everything returned by them is
// described by the records and enum domains below.
export enum DocRequest {
  Language = 1,
  Basics = 2,
  Commands = 4,
  Enums = 5,
  Controls = 6,
}

export function commandResultCode( record:CommandResultRecord ) {
  return `D${record}`
}

export function enumResultCode( record:EnumResultRecord ) {
  return `D${record}`
}

export function basicsResultCode( record:BasicsResultRecord ) {
  return `D${record}`
}

export function controlResultCode( record:ControlResultRecord ) {
  return `D${record}`
}

export function docRequestCode( request:DocRequest ) {
  return `D${request}`
}

export const CommandResultRecordDomain = enumDomain(
  GGGDXEnumGroupIndex.CommandResultRecord,
  "CommandResultRecord",
  EnumDomainKind.Enum,
  enumValues( [
    { index: CommandResultRecord.Command, name: "command", description: "D1/D4 command or record schema." },
    { index: CommandResultRecord.Argument, name: "argument", description: "D1/D4 argument schema." },
    { index: CommandResultRecord.Return, name: "return", description: "D1/D4 command-to-command return relation." },
    { index: CommandResultRecord.Example, name: "example", description: "D1/D4 command-relative source example." },
  ] ),
  "Record types emitted by D1 and D4.",
)

export const EnumResultRecordDomain = enumDomain(
  GGGDXEnumGroupIndex.EnumResultRecord,
  "EnumResultRecord",
  EnumDomainKind.Enum,
  enumValues( [
    { index: EnumResultRecord.Group, name: "group", description: "D1/D5 enum group." },
    { index: EnumResultRecord.Entry, name: "entry", description: "D1/D5 enum entry." },
  ] ),
  "Record types emitted by D1 and D5.",
)

export const MessageKindDomain = enumDomain(
  GGGDXEnumGroupIndex.MessageKind,
  "MessageKind",
  EnumDomainKind.Enum,
  enumValues( [
    { index: MessageKind.Command, name: messageKindNames[MessageKind.Command], description: "Executable request command." },
    { index: MessageKind.Result, name: messageKindNames[MessageKind.Result], description: "Non-executable result record emitted by a command." },
  ] ),
  "Whether a described message is executable or emitted output.",
)

export const BasicsResultRecordDomain = enumDomain(
  GGGDXEnumGroupIndex.BasicsResultRecord,
  "BasicsResultRecord",
  EnumDomainKind.Enum,
  enumValues( [
    { index: BasicsResultRecord.Rule, name: "rule", description: "D1/D2 core grammar rule." },
    { index: BasicsResultRecord.Example, name: "example", description: "D1/D2 valid or invalid source example." },
  ] ),
  "Record types emitted by D1 and D2.",
)

export const GrammarRuleKindDomain = enumDomain(
  GGGDXEnumGroupIndex.GrammarRuleKind,
  "GrammarRuleKind",
  EnumDomainKind.Enum,
  enumValues( Object.entries( grammarRuleKindNames ).map( ( [ index, name ] ) => ( {
    index: Number( index ),
    name,
  } ) ) ),
  "Kinds of core grammar rules emitted by D2.",
)

export const GrammarExampleKindDomain = enumDomain(
  GGGDXEnumGroupIndex.GrammarExampleKind,
  "GrammarExampleKind",
  EnumDomainKind.Enum,
  enumValues( Object.entries( grammarExampleKindNames ).map( ( [ index, name ] ) => ( {
    index: Number( index ),
    name,
  } ) ) ),
  "Whether a D2 source example is valid or invalid.",
)

export const ControlResultRecordDomain = enumDomain(
  GGGDXEnumGroupIndex.ControlResultRecord,
  "ControlResultRecord",
  EnumDomainKind.Enum,
  enumValues( [
    {
      index: ControlResultRecord.Description,
      name: "description",
      description: "D1/D6 self-contained JSON control description.",
    },
  ] ),
  "Record types emitted by D1 and D6.",
)

export const GGGDXEnumDomains = [
  CommandResultRecordDomain,
  EnumResultRecordDomain,
  MessageKindDomain,
  BasicsResultRecordDomain,
  GrammarRuleKindDomain,
  GrammarExampleKindDomain,
  ControlResultRecordDomain,
]

// Domains required by the documentation extension itself.
export const DocEnumDomains = [
  ...GGGEnumDomains,
  ...GGGDXEnumDomains,
]

export const DocResultRecords: Record<string, CommandDescribed> = {
  [basicsResultCode( BasicsResultRecord.Rule )]: {
    description: "Describes one stable core grammar rule.",
    args: {
      [GGG.Alias]: { description: "Stable rule name.", kind: ArgumentKind.String },
      [GGG.Storage]: { description: "Grammar rule kind.", domain: GrammarRuleKindDomain },
      [GGG.Value]: { description: "Literal token or canonical non-literal form.", kind: ArgumentKind.String },
      [GGG.Data]: { description: "Rule meaning.", kind: ArgumentKind.String },
    },
  },
  [basicsResultCode( BasicsResultRecord.Example )]: {
    description: "Provides one complete valid or invalid GGG source line.",
    args: {
      [GGG.Storage]: { description: "Valid or invalid example.", domain: GrammarExampleKindDomain },
      [GGG.Value]: { description: "Complete source line; copy valid examples exactly.", kind: ArgumentKind.String },
      [GGG.Data]: { description: "Explanation.", kind: ArgumentKind.String },
    },
  },
  [commandResultCode( CommandResultRecord.Command )]: {
    description: "Describes one command or result-record schema.",
    args: {
      [GGG.Command]: { description: "Command or record code.", kind: ArgumentKind.String },
      [GGG.Storage]: { description: "Executable command or non-executable result record.", domain: MessageKindDomain },
      [GGG.Size]: { description: "Number of described arguments.", kind: ArgumentKind.Number },
      [GGG.Data]: { description: "Description.", kind: ArgumentKind.String },
    },
  },
  [commandResultCode( CommandResultRecord.Argument )]: {
    description: "Describes one argument in a command or result record.",
    args: {
      [GGG.Command]: { description: "Owning command or record code.", kind: ArgumentKind.String },
      [GGG.Argument]: { description: "Argument glyph.", kind: ArgumentKind.String },
      [GGG.Storage]: { description: "Argument semantic kind.", domain: ArgumentKindDomain },
      [GGG.Register]: { description: "Named enum/reference domain.", domain: EnumGroupDomain },
      [GGG.Transform]: { description: "Canonical non-literal shape label; never copy it as wire punctuation.", kind: ArgumentKind.String },
      [GGG.Repeat]: { description: "Required flag.", kind: ArgumentKind.Boolean },
      [GGG.Data]: { description: "Description.", kind: ArgumentKind.String },
    },
  },
  [commandResultCode( CommandResultRecord.Return )]: {
    description: "Describes one command returned by another command.",
    args: {
      [GGG.Command]: { description: "Originating command code.", kind: ArgumentKind.String },
      [GGG.Target]: { description: "Returned command code.", kind: ArgumentKind.String },
      [GGG.Data]: { description: "Description.", kind: ArgumentKind.String },
    },
  },
  [commandResultCode( CommandResultRecord.Example )]: {
    description: "Provides one command-relative GGG source example.",
    args: {
      [GGG.Command]: { description: "Owning command or record code.", kind: ArgumentKind.String },
      [GGG.Value]: { description: "Source snippet interpreted in the owning command's context.", kind: ArgumentKind.String },
      [GGG.Data]: { description: "Explanation.", kind: ArgumentKind.String },
    },
  },
  [enumResultCode( EnumResultRecord.Group )]: {
    description: "Describes one enum/reference group.",
    args: {
      [GGG.Register]: { description: "Enum group.", domain: EnumGroupDomain },
      [GGG.Alias]: { description: "Stable group name.", kind: ArgumentKind.String },
      [GGG.Size]: { description: "Number of populated entries.", kind: ArgumentKind.Number },
      [GGG.Storage]: { description: "Fixed enum or live reference table.", domain: EnumDomainKindDomain },
      [GGG.Data]: { description: "Description.", kind: ArgumentKind.String },
    },
  },
  [enumResultCode( EnumResultRecord.Entry )]: {
    description: "Describes one value in an enum/reference group.",
    args: {
      [GGG.Register]: { description: "Owning enum group.", domain: EnumGroupDomain },
      [GGG.Value]: { description: "Actual wire value or reference index.", kind: ArgumentKind.Number },
      [GGG.Alias]: { description: "Stable value name.", kind: ArgumentKind.String },
      [GGG.Data]: { description: "Description.", kind: ArgumentKind.String },
    },
  },
  [controlResultCode( ControlResultRecord.Description )]: {
    description: "Provides one self-contained JSON UI control description.",
    args: {
      [GGG.Value]: {
        description: "Opaque JSON object whose schema and semantics are defined externally.",
        kind: ArgumentKind.String,
        format: "json-object",
      },
    },
  },
}
