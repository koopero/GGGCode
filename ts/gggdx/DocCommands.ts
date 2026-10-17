import { Command, ControlDescription, GGG, Hooks, Token } from "../ggg/Language"
import {
  BasicsResultRecord,
  CommandResultRecord,
  ControlResultRecord,
  DocEnumDomains,
  DocResultRecords,
  DocRequest,
  EnumResultRecord,
  MessageKind,
  basicsResultCode,
  commandResultCode,
  controlResultCode,
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
  ControlsList: docRequestCode( DocRequest.Controls ),
  GrammarRuleResult: basicsResultCode( BasicsResultRecord.Rule ),
  GrammarExampleResult: basicsResultCode( BasicsResultRecord.Example ),
  CommandResult: commandResultCode( CommandResultRecord.Command ),
  ArgumentResult: commandResultCode( CommandResultRecord.Argument ),
  ReturnResult: commandResultCode( CommandResultRecord.Return ),
  ExampleResult: commandResultCode( CommandResultRecord.Example ),
  EnumGroupResult: enumResultCode( EnumResultRecord.Group ),
  EnumEntryResult: enumResultCode( EnumResultRecord.Entry ),
  ControlDescriptionResult: controlResultCode( ControlResultRecord.Description ),
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

    for ( const example of spec.examples || [] ) {
      const exampleArgs = [
        arg( GGG.Command, commandCode ),
        arg( GGG.Value, example.source ),
      ]
      optionalStringArg( exampleArgs, GGG.Data, example.description )
      machine.output( line( gggdxCodes.ExampleResult, exampleArgs ) )
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

function controlJson( control:ControlDescription ) {
  if ( !control || typeof control !== "object" || Array.isArray( control ) ) {
    throw new Error( "A D-60 control description must be a JSON object." )
  }
  const json = JSON.stringify( control )
  if ( !json || !json.startsWith( "{" ) ) {
    throw new Error( "A D-60 control description must serialize as a JSON object." )
  }
  return json
}

function outputControls( machine:any ) {
  for ( const spec of Object.values( machine.commands ) as Command[] ) {
    for ( const control of spec.controls || [] ) {
      // Backtick strings consume the rest of the line, so JSON quotes need no
      // GGG escaping. JSON.stringify keeps the record on one physical line.
      machine.output(
        `${gggdxCodes.ControlDescriptionResult} ${GGG.Value}${GGG.StringToEOL}`
        + `${controlJson( control )}${GGG.End}`,
      )
    }
  }
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
  [gggdxCodes.ExampleResult]: "Command-relative source example.",
}

const enumResponses = {
  [gggdxCodes.EnumGroupResult]: "Enum/reference group.",
  [gggdxCodes.EnumEntryResult]: "Enum/reference entry.",
}

const controlResponses = {
  [gggdxCodes.ControlDescriptionResult]: "Self-contained JSON UI control description.",
}

function resultRecords( codes:string[] ) {
  return Object.fromEntries( codes.map( code => [ code, DocResultRecords[code] ] ) )
}

const commandResultRecords = resultRecords( [
  gggdxCodes.CommandResult,
  gggdxCodes.ArgumentResult,
  gggdxCodes.ReturnResult,
  gggdxCodes.ExampleResult,
] )

const basicsResultRecords = resultRecords( [
  gggdxCodes.GrammarRuleResult,
  gggdxCodes.GrammarExampleResult,
] )

const enumResultRecords = resultRecords( [
  gggdxCodes.EnumGroupResult,
  gggdxCodes.EnumEntryResult,
] )

const controlResultRecords = resultRecords( [
  gggdxCodes.ControlDescriptionResult,
] )

const DocCommands:Record<string,Command> = {
  [ gggdxCodes.LanguageDescription ]: {
    description: "Describe the language.",
    responds: {
      ...basicsResponses,
      ...commandResponses,
      ...enumResponses,
      ...controlResponses,
      "OK": "Language described successfully.",
    },
    domains: DocEnumDomains,
    [Hooks.End]: ( { machine }:any ) => {
      outputLanguageBasics( machine )
      outputCommands( machine )
      outputEnums( machine )
      outputControls( machine )
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
  [ gggdxCodes.ControlsList ]: {
    description: "List self-contained JSON UI control descriptions.",
    responds: {
      ...controlResponses,
      "OK": "Control descriptions listed successfully.",
    },
    records: controlResultRecords,
    domains: DocEnumDomains,
    [Hooks.End]: ( { machine }:any ) => {
      outputControls( machine )
      machine.outputOk()
    },
  },
}

export default DocCommands
