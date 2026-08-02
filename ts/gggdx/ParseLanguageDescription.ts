import { isArray } from "../common/util"
import {
  ControlDescription,
  GGG,
  Token,
} from "../ggg/Language"
import {
  enumDomainKindNames,
  enumValueNames,
} from "../ggg/EnumRepository"
import ParseLines, { ParseLinesArgs } from "../ggg/ParseLines"
import {
  BasicsResultRecord,
  CommandResultRecord,
  ControlResultRecord,
  EnumResultRecord,
  basicsResultCode,
  commandResultCode,
  controlResultCode,
  enumResultCode,
  grammarExampleKindNames,
  grammarRuleKindNames,
  messageKindNames,
} from "./Protocol"

const languageDescriptionCodes = {
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

export type LanguageGrammarRuleKind =
  typeof grammarRuleKindNames[keyof typeof grammarRuleKindNames]

export type LanguageGrammarExampleKind =
  typeof grammarExampleKindNames[keyof typeof grammarExampleKindNames]

export type LanguageMessageKind =
  typeof messageKindNames[keyof typeof messageKindNames]

export type LanguageArgumentKind =
  typeof enumValueNames[keyof typeof enumValueNames]

export type LanguageDomainKind =
  typeof enumDomainKindNames[keyof typeof enumDomainKindNames]

export type LanguageGrammarRule = {
  name:string,
  kind:LanguageGrammarRuleKind,
  value:string,
  description:string,
}

export type LanguageGrammarExample = {
  kind:LanguageGrammarExampleKind,
  source:string,
  description:string,
}

export type LanguageDomainValue = {
  value:number,
  name:string,
  description?:string,
}

export type LanguageDomain = {
  index:number,
  name:string,
  kind:LanguageDomainKind,
  valueCount:number,
  description?:string,
  values:LanguageDomainValue[],
  valuesByName:Record<string, LanguageDomainValue>,
  valuesByValue:Record<number, LanguageDomainValue>,
}

export type LanguageArgument = {
  code:string,
  kind:LanguageArgumentKind,
  required:boolean,
  description?:string,
  format?:string,
  domainName?:string,
  domain?:LanguageDomain,
}

export type LanguageResponse = {
  code:string,
  description?:string,
  message?:LanguageMessage,
}

export type LanguageCommandExample = {
  source:string,
  description?:string,
}

export type LanguageMessage = {
  code:string,
  kind:LanguageMessageKind,
  argumentCount:number,
  description?:string,
  args:Record<string, LanguageArgument>,
  responses:Record<string, LanguageResponse>,
  examples:LanguageCommandExample[],
}

export type LanguageDescription = {
  basics: {
    rules:Record<string, LanguageGrammarRule>,
    examples:LanguageGrammarExample[],
  },
  messages:Record<string, LanguageMessage>,
  commands:Record<string, LanguageMessage>,
  records:Record<string, LanguageMessage>,
  domains:Record<string, LanguageDomain>,
  domainsByIndex:Record<number, LanguageDomain>,
  controls:ControlDescription[],
  // Unrecognized records are retained so a newer peer does not make an older
  // parser discard extension data it cannot interpret yet.
  unknownRecords:Token[],
}

export type ParseLanguageDescriptionOptions = {
  // Required fields are always checked. Strict mode additionally verifies
  // counts and cross-record references. It is enabled for complete D1 output.
  strict?:boolean,
}

export class LanguageDescriptionParseError extends Error {
  row?:number
  record?:string

  constructor( message:string, token?:Token ) {
    const row = token?.row
    const record = token?.command || token?.code
    const where = row ? ` at line ${row}` : ""
    super( `${message}${where}` )
    this.name = "LanguageDescriptionParseError"
    this.row = row
    this.record = record
  }
}

function fail( message:string, token?:Token ):never {
  throw new LanguageDescriptionParseError( message, token )
}

function dictionary<T>():Record<string, T> {
  return Object.create( null ) as Record<string, T>
}

function hasOwn( collection:object, key:string|number ) {
  return Object.prototype.hasOwnProperty.call( collection, key )
}

function tokenArg( token:Token, code:string ) {
  return token.args?.find( arg => arg.code === code )
}

function unwrapScalar( value:any ) {
  if ( isArray( value ) ) value = value[0]
  if (
    value
    && typeof value === "object"
    && "value" in value
    && "encoding" in value
  )
    value = value.value
  return value
}

function optionalValue( token:Token, code:string ) {
  const arg = tokenArg( token, code )
  return arg ? unwrapScalar( arg.data ) : undefined
}

function requiredString( token:Token, code:string, label:string ) {
  const value = optionalValue( token, code )
  if ( typeof value !== "string" )
    return fail( `${token.command || "Record"} requires string ${code} (${label}).`, token )
  return value
}

function optionalString( token:Token, code:string, label:string ) {
  const value = optionalValue( token, code )
  if ( value === undefined ) return undefined
  if ( typeof value !== "string" )
    return fail( `${token.command || "Record"} requires string ${code} (${label}).`, token )
  return value
}

function requiredInteger( token:Token, code:string, label:string ) {
  const value = optionalValue( token, code )
  if ( typeof value !== "number" || !Number.isInteger( value ) )
    return fail( `${token.command || "Record"} requires integer ${code} (${label}).`, token )
  return value
}

function optionalBoolean( token:Token, code:string, label:string ) {
  const value = optionalValue( token, code )
  if ( value === undefined ) return false
  if ( typeof value === "boolean" ) return value
  if ( typeof value === "number" ) return value !== 0
  return fail( `${token.command || "Record"} requires boolean ${code} (${label}).`, token )
}

function enumString<T extends string>(
  token:Token,
  code:string,
  label:string,
  allowed:readonly T[],
):T {
  const value = requiredString( token, code, label )
  if ( !allowed.includes( value as T ) )
    return fail( `${token.command || "Record"} has unknown ${label} ${JSON.stringify( value )}.`, token )
  return value as T
}

function defineUnique<T>(
  collection:Record<string, T>,
  key:string,
  value:T,
  label:string,
  token:Token,
) {
  if ( hasOwn( collection, key ) )
    fail( `Duplicate ${label} ${JSON.stringify( key )}.`, token )
  collection[key] = value
}

function failureValue( token:Token ) {
  const failure = token.args?.find( arg => arg.code?.startsWith( GGG.Failure ) )
  if ( !failure ) return undefined
  if ( failure.code !== GGG.Failure ) return failure.code?.substring( 1 )
  return unwrapScalar( failure.data )
}

function parseControl( token:Token ):ControlDescription {
  const source = requiredString( token, GGG.Value, "JSON object" )
  let value:any
  try {
    value = JSON.parse( source )
  } catch ( error:any ) {
    return fail( `Invalid D-60 JSON: ${error.message || error}.`, token )
  }
  if ( !value || typeof value !== "object" || Array.isArray( value ) )
    return fail( "D-60 must contain one JSON object.", token )
  return value as ControlDescription
}

/**
 * Parse a complete gggdx D1 response into linked, typed repositories.
 * Accepts raw wire text/lines and the token forms returned by Runner or Machine.
 */
export function ParseLanguageDescription(
  input:ParseLinesArgs,
  options:ParseLanguageDescriptionOptions = {},
):LanguageDescription {
  const { strict = true } = options
  const description:LanguageDescription = {
    basics: { rules: dictionary(), examples: [] },
    messages: dictionary(),
    commands: dictionary(),
    records: dictionary(),
    domains: dictionary(),
    domainsByIndex: dictionary(),
    controls: [],
    unknownRecords: [],
  }
  const pendingArguments:Token[] = []
  const pendingResponses:Token[] = []
  const pendingExamples:Token[] = []
  const pendingDomainValues:Token[] = []

  for ( const token of ParseLines( input ) ) {
    const record = token.command || token.code || ""
    if ( !record ) continue

    // ParseLines normalizes OK to O1. Either form is a terminator, and a
    // failure terminator must not be mistaken for a successful description.
    if ( record.startsWith( GGG.Okay ) ) {
      const failure = failureValue( token )
      if ( failure !== undefined )
        fail( `Language description ended with failure F${failure}.`, token )
      continue
    }

    switch ( record ) {
      case languageDescriptionCodes.GrammarRuleResult: {
        const rule:LanguageGrammarRule = {
          name: requiredString( token, GGG.Alias, "rule name" ),
          kind: enumString(
            token,
            GGG.Storage,
            "grammar rule kind",
            Object.values( grammarRuleKindNames ),
          ),
          value: requiredString( token, GGG.Value, "rule value" ),
          description: requiredString( token, GGG.Data, "rule description" ),
        }
        defineUnique( description.basics.rules, rule.name, rule, "grammar rule", token )
        break
      }

      case languageDescriptionCodes.GrammarExampleResult:
        description.basics.examples.push( {
          kind: enumString(
            token,
            GGG.Storage,
            "grammar example kind",
            Object.values( grammarExampleKindNames ),
          ),
          source: requiredString( token, GGG.Value, "example source" ),
          description: requiredString( token, GGG.Data, "example description" ),
        } )
        break

      case languageDescriptionCodes.CommandResult: {
        const message:LanguageMessage = {
          code: requiredString( token, GGG.Command, "message code" ),
          kind: enumString(
            token,
            GGG.Storage,
            "message kind",
            Object.values( messageKindNames ),
          ),
          argumentCount: requiredInteger( token, GGG.Size, "argument count" ),
          description: optionalString( token, GGG.Data, "description" ),
          args: dictionary(),
          responses: dictionary(),
          examples: [],
        }
        if ( message.argumentCount < 0 )
          fail( `${message.code} has a negative argument count.`, token )
        defineUnique( description.messages, message.code, message, "message", token )
        defineUnique(
          message.kind === "command" ? description.commands : description.records,
          message.code,
          message,
          message.kind,
          token,
        )
        break
      }

      case languageDescriptionCodes.ArgumentResult:
        pendingArguments.push( token )
        break

      case languageDescriptionCodes.ReturnResult:
        pendingResponses.push( token )
        break

      case languageDescriptionCodes.ExampleResult:
        pendingExamples.push( token )
        break

      case languageDescriptionCodes.EnumGroupResult: {
        const domain:LanguageDomain = {
          index: requiredInteger( token, GGG.Register, "domain index" ),
          name: requiredString( token, GGG.Alias, "domain name" ),
          kind: enumString(
            token,
            GGG.Storage,
            "domain kind",
            Object.values( enumDomainKindNames ),
          ),
          valueCount: requiredInteger( token, GGG.Size, "value count" ),
          description: optionalString( token, GGG.Data, "description" ),
          values: [],
          valuesByName: dictionary(),
          valuesByValue: dictionary(),
        }
        if ( domain.valueCount < 0 )
          fail( `${domain.name} has a negative value count.`, token )
        defineUnique( description.domains, domain.name, domain, "domain", token )
        defineUnique(
          description.domainsByIndex as Record<string, LanguageDomain>,
          domain.index.toString(),
          domain,
          "domain index",
          token,
        )
        break
      }

      case languageDescriptionCodes.EnumEntryResult:
        pendingDomainValues.push( token )
        break

      case languageDescriptionCodes.ControlDescriptionResult:
        description.controls.push( parseControl( token ) )
        break

      default:
        description.unknownRecords.push( token )
        break
    }
  }

  function messageOwner( token:Token ) {
    const code = requiredString( token, GGG.Command, "owning message code" )
    const owner = description.messages[code]
    if ( !owner ) {
      if ( strict ) fail( `${token.command} refers to unknown message ${JSON.stringify( code )}.`, token )
      description.unknownRecords.push( token )
    }
    return owner
  }

  for ( const token of pendingArguments ) {
    const owner = messageOwner( token )
    if ( !owner ) continue
    const argument:LanguageArgument = {
      code: requiredString( token, GGG.Argument, "argument glyph" ),
      kind: enumString(
        token,
        GGG.Storage,
        "argument kind",
        Object.values( enumValueNames ),
      ),
      required: optionalBoolean( token, GGG.Repeat, "required flag" ),
      domainName: optionalString( token, GGG.Register, "domain name" ),
      format: optionalString( token, GGG.Transform, "format" ),
      description: optionalString( token, GGG.Data, "description" ),
    }
    defineUnique( owner.args, argument.code, argument, "argument", token )
  }

  for ( const token of pendingResponses ) {
    const owner = messageOwner( token )
    if ( !owner ) continue
    const response:LanguageResponse = {
      code: requiredString( token, GGG.Target, "response code" ),
      description: optionalString( token, GGG.Data, "description" ),
    }
    defineUnique( owner.responses, response.code, response, "response", token )
  }

  for ( const token of pendingExamples ) {
    const owner = messageOwner( token )
    if ( !owner ) continue
    owner.examples.push( {
      source: requiredString( token, GGG.Value, "example source" ),
      description: optionalString( token, GGG.Data, "description" ),
    } )
  }

  for ( const token of pendingDomainValues ) {
    const index = requiredInteger( token, GGG.Register, "owning domain index" )
    const domain = description.domainsByIndex[index]
    if ( !domain ) {
      if ( strict ) fail( `${token.command} refers to unknown domain index ${index}.`, token )
      description.unknownRecords.push( token )
      continue
    }
    const value:LanguageDomainValue = {
      value: requiredInteger( token, GGG.Value, "wire value" ),
      name: requiredString( token, GGG.Alias, "value name" ),
      description: optionalString( token, GGG.Data, "description" ),
    }
    const valueKey = value.value.toString()
    if ( hasOwn( domain.valuesByValue, valueKey ) )
      fail( `Duplicate value ${value.value} in domain ${JSON.stringify( domain.name )}.`, token )
    if ( value.name && hasOwn( domain.valuesByName, value.name ) )
      fail( `Duplicate name ${JSON.stringify( value.name )} in domain ${JSON.stringify( domain.name )}.`, token )
    domain.values.push( value )
    domain.valuesByValue[value.value] = value
    if ( value.name ) domain.valuesByName[value.name] = value
  }

  for ( const message of Object.values( description.messages ) ) {
    if ( strict && Object.keys( message.args ).length !== message.argumentCount ) {
      fail(
        `${message.code} declares ${message.argumentCount} arguments but `
        + `${Object.keys( message.args ).length} were described.`,
      )
    }
    for ( const argument of Object.values( message.args ) ) {
      if ( !argument.domainName ) continue
      argument.domain = description.domains[argument.domainName]
      if ( strict && !argument.domain )
        fail( `${message.code} ${argument.code} refers to unknown domain ${JSON.stringify( argument.domainName )}.` )
    }
    for ( const response of Object.values( message.responses ) ) {
      response.message = description.messages[response.code]
    }
  }

  for ( const domain of Object.values( description.domains ) ) {
    if ( strict && domain.values.length !== domain.valueCount ) {
      fail(
        `${domain.name} declares ${domain.valueCount} values but `
        + `${domain.values.length} were described.`,
      )
    }
  }

  return description
}

export default ParseLanguageDescription
