import { describe, expect, test } from "@jest/globals"
import {
  Format,
  LanguageDescriptionParseError,
  Machine,
  ParseLanguageDescription,
} from "../ts"
import Matrix from "../ts/ggg/Matrix"
import BuiltinCommands from "../ts/builtin"
import { Runner } from "../ts/stream/Runner"

function protocolMachine() {
  const machine = new Machine( {
    commands: {
      ...BuiltinCommands,
      U60: {
        description: "Test control contributor.",
        controls: [ {
          type: "test",
          binding: { command: "G20", argument: "V" },
        } ],
      },
    },
  } )
  machine.getRegisterList( Matrix ).add(
    new Matrix( { dim: [1], data: [42] } ),
    { name: "r" },
  )
  return machine
}

describe( "ParseLanguageDescription", () => {
  test( "turns complete D1 wire output into linked, typed lookups", async () => {
    const output = await protocolMachine().run( "D1" )
    const wire = output.map( Format ).join( "" )
    const language = ParseLanguageDescription( wire )

    expect( language.basics.rules["argument.form"] ).toMatchObject( {
      kind: "form",
      value: "glyph+data",
    } )
    expect( language.basics.examples.some( example =>
      example.kind === "invalid" && example.source === "# comment"
    ) ).toBe( true )

    expect( language.commands.G20 ).toBe( language.messages.G20 )
    expect( language.commands.G20.kind ).toBe( "command" )
    expect( language.records["D-60"].kind ).toBe( "result" )
    expect( language.records["D-60"].args.V.format ).toBe( "json-object" )

    const registerDomain = language.domains["ggggx.register"]
    expect( registerDomain ).toBe( language.domainsByIndex[10] )
    expect( registerDomain.kind ).toBe( "reference" )
    expect( registerDomain.valuesByName.r ).toMatchObject( { value: 0 } )
    expect( language.commands.G40.args.R.domain ).toBe( registerDomain )

    expect( language.domains["ggggx.operator"].valuesByValue[57].name ).toBe( "atanh" )
    expect( language.commands.G10.responses.G20.message ).toBe( language.commands.G20 )
    // Some currently advertised emissions do not have a D-40 schema. Their
    // code and description remain available without a linked message.
    expect( language.commands.G1.responses["G-1"] ).toMatchObject( {
      code: "G-1",
      message: undefined,
    } )
    expect( language.commands.G20.examples ).toContainEqual( {
      source: "GK",
      description: "Repeat to size.",
    } )
    expect( language.controls ).toEqual( [ {
      type: "test",
      binding: { command: "G20", argument: "V" },
    } ] )
    expect( language.unknownRecords ).toEqual( [] )
  } )

  test( "accepts Runner tokens, which exclude the OK terminator", async () => {
    const runner = new Runner( { machine: protocolMachine() } )
    const [ result ] = await runner.run( "D1" )
    const language = ParseLanguageDescription( result.tokens )

    expect( result.status ).toBe( "ok" )
    expect( language.commands.D6.responses["D-60"].message ).toBe(
      language.records["D-60"],
    )
    expect( language.controls ).toHaveLength( 1 )
  } )

  test( "accepts direct Machine tokens and detects token-form failures", async () => {
    const output = await protocolMachine().run( "D1" )
    const language = ParseLanguageDescription( output )

    expect( language.commands.G20 ).toBeDefined()
    expect( () => ParseLanguageDescription( {
      code: "OK",
      args: [ { code: "F7" } ],
    } ) ).toThrow( "Language description ended with failure F7." )
  } )

  test( "preserves unknown future records", () => {
    const language = ParseLanguageDescription(
      'D-99 V"future"\n',
      { strict: false },
    )

    expect( language.unknownRecords ).toHaveLength( 1 )
    expect( language.unknownRecords[0].command ).toBe( "D-99" )
  } )

  test( "treats remote names as keys without prototype collisions", () => {
    const language = ParseLanguageDescription( [
      'D-50 R1 L"__proto__" S1 T"reference"',
      'D-51 R1 V0 L"constructor"',
    ] )

    expect( language.domains["__proto__"].name ).toBe( "__proto__" )
    expect( language.domains["__proto__"].valuesByName["constructor"].value ).toBe( 0 )
  } )

  test( "rejects invalid controls and orphaned relationship records", () => {
    expect( () => ParseLanguageDescription( "D-60 V`[]\n" ) ).toThrow(
      "D-60 must contain one JSON object.",
    )
    expect( () => ParseLanguageDescription(
      'D-41 B"G20" U"V" T"number"\n',
    ) ).toThrow( LanguageDescriptionParseError )
  } )
} )
