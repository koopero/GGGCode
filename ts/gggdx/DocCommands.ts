import { Command, GGG, Hooks, Token } from "../ggg/Language"
import {
  BasicsResultRecord,
  CommandResultRecord,
  DocEnumDomains,
  DocResultRecords,
  DocRequest,
  EnumResultRecord,
  MessageKind,
  basicsResultCode,
  commandResultCode,
  docRequestCode,
  enumResultCode,
  grammarExampleKindNames,
  grammarRuleKindNames,
  messageKindNames,
} from "./Protocol"
import { GrammarExamples, GrammarRules } from "./LanguageBasics"
import {
  argumentKind,
  enumDomainKindNames,
  enumValueNames,
  valuesForDomain,
} from "../ggg/EnumRepository"

// Public wire names are derived from the owned numeric protocol constants.
export const gggdxCodes = {
  LanguageDescription: docRequestCode( DocRequest.Language ),
  LanguageBasics: docRequestCode( DocRequest.Basics ),
  CommandsList: docRequestCode( DocRequest.Commands ),
  EnumsList: docRequestCode( DocRequest.Enums ),
  GrammarRuleResult: basicsResultCode( BasicsResultRecord.Rule ),
  GrammarExampleResult: basicsResultCode( BasicsResultRecord.Example ),
  CommandResult: commandResultCode( CommandResultRecord.Command ),
  ArgumentResult: commandResultCode( CommandResultRecord.Argument ),
  ReturnResult: commandResultCode( CommandResultRecord.Return ),
  EnumGroupResult: enumResultCode( EnumResultRecord.Group ),
  EnumEntryResult: enumResultCode( EnumResultRecord.Entry ),
} as const

function arg( code:string, data:string|number|boolean ): Token {
  return { code, data }
}

function line( command:string, args:Token[] ): Token {
  return { command, args, eol: true }
}

function optionalStringArg( args:Token[], code:string, value:string|undefined ) {
  if ( value ) args.push( arg( code, value ) )
}

function responseDescription( response:any ) {
  return typeof response === "string" ? response : response?.description
}

function outputLanguageBasics( machine:any ) {
  for ( const rule of GrammarRules ) {
    machine.output( line( gggdxCodes.GrammarRuleResult, [
      arg( GGG.Alias, rule.name ),
      arg( GGG.Storage, grammarRuleKindNames[rule.kind] ),
      arg( GGG.Value, rule.value ),
      arg( GGG.Data, rule.description ),
    ] ) )
  }

  for ( const example of GrammarExamples ) {
    machine.output( line( gggdxCodes.GrammarExampleResult, [
      arg( GGG.Storage, grammarExampleKindNames[example.kind] ),
      arg( GGG.Value, example.source ),
      arg( GGG.Data, example.description ),
    ] ) )
  }
}

function outputCommands( machine:any ) {
  for ( const commandCode in machine.messages ) {
    const spec = machine.messages[commandCode]
    const messageKind = commandCode in machine.commands
      ? MessageKind.Command
      : MessageKind.Result
    const describedArgs = spec.args || {}
    const commandArgs:Token[] = [
      arg( GGG.Command, commandCode ),
      arg( GGG.Storage, messageKindNames[messageKind] ),
      arg( GGG.Size, Object.keys( describedArgs ).length ),
    ]
    optionalStringArg( commandArgs, GGG.Data, spec.description )
    machine.output( line( gggdxCodes.CommandResult, commandArgs ) )

    for ( const code in describedArgs ) {
      const described = describedArgs[code]
      const kind = argumentKind( described )
      const resultArgs:Token[] = [
        arg( GGG.Command, commandCode ),
        arg( GGG.Argument, code ),
        arg( GGG.Storage, enumValueNames[kind] ),
      ]
      if ( described.domain ) resultArgs.push( arg( GGG.Register, described.domain.name ) )
      optionalStringArg( resultArgs, GGG.Transform, described.format )
      if ( described.required ) resultArgs.push( arg( GGG.Repeat, true ) )
      optionalStringArg( resultArgs, GGG.Data, described.description )
      machine.output( line( gggdxCodes.ArgumentResult, resultArgs ) )
    }

    for ( const returnedCommand in spec.responds || {} ) {
      const returnArgs:Token[] = [
        arg( GGG.Command, commandCode ),
        arg( GGG.Target, returnedCommand ),
      ]
      optionalStringArg(
        returnArgs,
        GGG.Data,
        responseDescription( spec.responds[returnedCommand] ),
      )
      machine.output( line( gggdxCodes.ReturnResult, returnArgs ) )
    }
  }
}

function outputEnums( machine:any ) {
  machine.enumDomains.eachPair( domain => {
    const values = valuesForDomain( domain, machine )
    const populated = values.values()
    const groupArgs:Token[] = [
      arg( GGG.Register, domain.index ),
      arg( GGG.Alias, domain.name ),
      arg( GGG.Size, populated.length ),
      arg( GGG.Storage, enumDomainKindNames[domain.kind] ),
    ]
    optionalStringArg( groupArgs, GGG.Data, domain.description )
    machine.output( line( gggdxCodes.EnumGroupResult, groupArgs ) )

    values.eachPair( value => {
      const entryArgs:Token[] = [
        arg( GGG.Register, domain.index ),
        arg( GGG.Value, value.index ?? -1 ),
        arg( GGG.Alias, value.name ?? "" ),
      ]
      optionalStringArg( entryArgs, GGG.Data, ( value as any ).description )
      machine.output( line( gggdxCodes.EnumEntryResult, entryArgs ) )
    } )
  } )
}

const protocolMetadata = {
  domains: DocEnumDomains,
}

const basicsResponses = {
  [gggdxCodes.GrammarRuleResult]: "Stable core grammar rule.",
  [gggdxCodes.GrammarExampleResult]: "Valid or invalid complete source example.",
}

const commandResponses = {
  [gggdxCodes.CommandResult]: "Command or result-record schema.",
  [gggdxCodes.ArgumentResult]: "Argument schema.",
  [gggdxCodes.ReturnResult]: "Command-to-command return relation.",
}

const enumResponses = {
  [gggdxCodes.EnumGroupResult]: "Enum/reference group.",
  [gggdxCodes.EnumEntryResult]: "Enum/reference entry.",
}

function resultRecords( codes:string[] ) {
  return Object.fromEntries( codes.map( code => [ code, DocResultRecords[code] ] ) )
}

const commandResultRecords = resultRecords( [
  gggdxCodes.CommandResult,
  gggdxCodes.ArgumentResult,
  gggdxCodes.ReturnResult,
] )

const basicsResultRecords = resultRecords( [
  gggdxCodes.GrammarRuleResult,
  gggdxCodes.GrammarExampleResult,
] )

const enumResultRecords = resultRecords( [
  gggdxCodes.EnumGroupResult,
  gggdxCodes.EnumEntryResult,
] )

const DocCommands:Record<string,Command> = {
  [ gggdxCodes.LanguageDescription ]: {
    description: "Describe the language.",
    responds: {
      ...basicsResponses,
      ...commandResponses,
      ...enumResponses,
      "OK": "Language described successfully.",
    },
    domains: DocEnumDomains,
    [Hooks.End]: ( { machine }:any ) => {
      outputLanguageBasics( machine )
      outputCommands( machine )
      outputEnums( machine )
      machine.outputOk()
    },
  },
  [ gggdxCodes.LanguageBasics ]: {
    description: "Describe stable core syntax and wire examples.",
    responds: {
      ...basicsResponses,
      "OK": "Language basics described successfully.",
    },
    ...protocolMetadata,
    records: basicsResultRecords,
    [Hooks.End]: ( { machine }:any ) => {
      outputLanguageBasics( machine )
      machine.outputOk()
    },
  },
  [ gggdxCodes.CommandsList ]: {
    description: "List command and result-record schemas.",
    responds: {
      ...commandResponses,
      "OK": "Command schemas listed successfully.",
    },
    ...protocolMetadata,
    records: commandResultRecords,
    [Hooks.End]: ( { machine }:any ) => {
      outputCommands( machine )
      machine.outputOk()
    },
  },
  [ gggdxCodes.EnumsList ]: {
    description: "List named enum and reference domains.",
    responds: {
      ...enumResponses,
      "OK": "Enum domains listed successfully.",
    },
    records: enumResultRecords,
    domains: DocEnumDomains,
    [Hooks.End]: ( { machine }:any ) => {
      outputEnums( machine )
      machine.outputOk()
    },
  },
}

export default DocCommands
