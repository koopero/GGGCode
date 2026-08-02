import { describe, expect, test } from "@jest/globals"
import { Format, Machine } from "../ts"
import Matrix from "../ts/ggg/Matrix"
import {
  BasicsResultRecord,
  BasicsResultRecordDomain,
  CommandResultRecord,
  CommandResultRecordDomain,
  EnumResultRecord,
  EnumResultRecordDomain,
  GGGDXEnumGroupIndex,
  GrammarExampleKind,
  GrammarRuleKind,
} from "../ts/gggdx/Protocol"
import DocCommands, { gggdxCodes } from "../ts/gggdx/DocCommands"
import { GGGGXEnumGroupIndex } from "../ts/ggggx/Domains"
import { GXCommands } from "../ts/ggggx/GXCommands"

async function run( machine:Machine, command:string ) {
  return ( await machine.run( command ) ).map( Format ).join( "" )
}

function protocolMachine() {
  const machine = new Machine( {
    commands: {
      ...GXCommands,
      ...DocCommands,
    },
  } )
  machine.getRegisterList( Matrix ).add(
    new Matrix( { dim: [1], data: [42] } ),
    { name: "r" },
  )
  return machine
}

describe( "gggdx structured self-description", () => {
  test( "record command codes are derived from owned enum values", () => {
    const commandValues = CommandResultRecordDomain.values
    const enumValues = EnumResultRecordDomain.values
    const basicsValues = BasicsResultRecordDomain.values
    if (
      typeof commandValues === "function"
      || typeof enumValues === "function"
      || typeof basicsValues === "function"
    )
      throw new Error( "Result record domains must be static NamedLists." )

    expect( commandValues.get( -40 )?.name ).toBe( "command" )
    expect( commandValues.get( -45 )?.name ).toBe( "example" )
    expect( enumValues.get( -50 )?.name ).toBe( "group" )
    expect( basicsValues.get( -20 )?.name ).toBe( "rule" )
    expect( gggdxCodes.LanguageDescription ).toBe( "D1" )
    expect( gggdxCodes.LanguageBasics ).toBe( "D2" )
    expect( gggdxCodes.CommandsList ).toBe( "D4" )
    expect( gggdxCodes.EnumsList ).toBe( "D5" )
    expect( gggdxCodes.GrammarRuleResult ).toBe( `D${BasicsResultRecord.Rule}` )
    expect( gggdxCodes.GrammarExampleResult ).toBe( `D${BasicsResultRecord.Example}` )
    expect( gggdxCodes.CommandResult ).toBe( `D${CommandResultRecord.Command}` )
    expect( gggdxCodes.ArgumentResult ).toBe( `D${CommandResultRecord.Argument}` )
    expect( gggdxCodes.ReturnResult ).toBe( `D${CommandResultRecord.Return}` )
    expect( gggdxCodes.ExampleResult ).toBe( `D${CommandResultRecord.Example}` )
    expect( gggdxCodes.EnumGroupResult ).toBe( `D${EnumResultRecord.Group}` )
    expect( gggdxCodes.EnumEntryResult ).toBe( `D${EnumResultRecord.Entry}` )
  } )

  test( "D2 describes grammar with copyable valid and explicit invalid examples", async () => {
    const output = await run( protocolMachine(), "D2" )

    expect( output ).not.toContain( "\n;" )
    expect( output ).toContain(
      'D-20 L"argument.form" T"form" V"glyph+data"',
    )
    expect( output ).toContain(
      'D-20 L"line.end" T"delimiter" V"\\\\n"',
    )
    expect( output ).toContain(
      'D-20 L"list.grouping" T"constraint" V"no-parentheses"',
    )
    expect( output ).toContain(
      'D-21 T"valid" V"G20 R0 P0,0 Q1 V1,0.5 ; trailing comment"',
    )
    expect( output ).toContain(
      'D-21 T"valid" V"P13 A\\"semicolon ; inside string\\""',
    )
    expect( output ).toContain(
      'D-21 T"invalid" V"G20 R0 P(0,0) V1"',
    )
    expect( output ).toContain(
      'D-21 T"invalid" V"# comment"',
    )
    expect( output.endsWith( "OK\n" ) ).toBe( true )
  } )

  test( "D4 lists commands and its result records as GGG", async () => {
    const output = await run( protocolMachine(), "D4" )

    expect( output ).not.toContain( "\n;" )
    expect( output ).not.toContain( "D-1" )
    expect( output ).toContain(
      'D-41 B"G40" U"R" T"reference" R"ggggx.register"',
    )
    expect( output ).toContain(
      'D-41 B"G40" U"T" T"enum" R"ggggx.transform"',
    )
    expect( output ).toContain( 'D-40 B"G40" T"command"' )
    expect( output ).toContain( 'D-40 B"D2" T"command"' )
    expect( output ).toContain( 'D-40 B"D-20" T"result"' )
    expect( output ).toContain( 'D-40 B"D-21" T"result"' )
    expect( output ).toContain( 'D-40 B"D-40" T"result"' )
    expect( output ).toContain(
      'D-41 B"G30" U"S" T"number" M"comma-list:axes=C,X,Y,Z"',
    )
    expect( output ).toContain(
      'D-40 B"G13" T"command" S1 A"Emit the whole buffer to the host display."',
    )
    expect( output ).not.toContain( 'D-41 B"G13" U"E"' )
    expect( output ).not.toContain( 'D-41 B"G13" U"P"' )
    expect( output ).not.toContain( 'D-41 B"G13" U"S"' )
    expect( output ).toContain( 'D-40 B"D-40"' )
    expect( output ).toContain( 'D-40 B"D-41"' )
    expect( output ).toContain( 'D-40 B"D-42"' )
    expect( output ).toContain( 'D-40 B"D-45"' )
    expect( output ).toContain( 'D-40 B"D-50"' )
    expect( output ).toContain( 'D-40 B"D-51"' )
    expect( output ).toContain(
      'D-41 B"D-41" U"R" T"reference" R"EnumGroup"',
    )
    expect( output ).toContain(
      'D-41 B"D-42" U"W" T"string" A"Returned command code."',
    )
    expect( output ).toContain(
      'D-42 B"G10" W"G20" A"Replayable buffer write."',
    )
    expect( output ).toContain(
      'D-45 B"G20" V"GK" A"Repeat to size."',
    )
    expect( output ).toContain(
      'D-41 B"D-45" U"V" T"string"',
    )
    expect( output ).toContain(
      'D-41 B"D-45" U"A" T"string"',
    )
    expect( output ).toContain(
      'D-42 B"D1" W"D-42" A"Command-to-command return relation."',
    )
    expect( output ).not.toContain( "\nD-50 " )
    expect( output.endsWith( "OK\n" ) ).toBe( true )
  } )

  test( "D5 preserves sparse values and publishes live references", async () => {
    const output = await run( protocolMachine(), "D5" )

    expect( output ).not.toContain( "\n;" )
    expect( output ).toContain(
      `D-51 R${GGGDXEnumGroupIndex.CommandResultRecord} V-40 L"command"`,
    )
    expect( output ).toContain(
      `D-51 R${GGGDXEnumGroupIndex.CommandResultRecord} V-41 L"argument"`,
    )
    expect( output ).toContain(
      `D-51 R${GGGDXEnumGroupIndex.CommandResultRecord} V-42 L"return"`,
    )
    expect( output ).toContain(
      `D-51 R${GGGDXEnumGroupIndex.CommandResultRecord} V-45 L"example"`,
    )
    expect( output ).toContain(
      `D-51 R${GGGDXEnumGroupIndex.EnumResultRecord} V-50 L"group"`,
    )
    expect( output ).toContain(
      `D-51 R${GGGDXEnumGroupIndex.EnumResultRecord} V-51 L"entry"`,
    )
    expect( output ).toContain(
      `D-51 R${GGGDXEnumGroupIndex.MessageKind} V0 L"command"`,
    )
    expect( output ).toContain(
      `D-51 R${GGGDXEnumGroupIndex.BasicsResultRecord} V-20 L"rule"`,
    )
    expect( output ).toContain(
      `D-51 R${GGGDXEnumGroupIndex.BasicsResultRecord} V-21 L"example"`,
    )
    expect( output ).toContain(
      `D-51 R${GGGDXEnumGroupIndex.GrammarRuleKind} V${GrammarRuleKind.Control} L"control"`,
    )
    expect( output ).toContain(
      `D-51 R${GGGDXEnumGroupIndex.GrammarExampleKind} V${GrammarExampleKind.Invalid} L"invalid"`,
    )
    expect( output ).toContain(
      'D-51 R11 V8 L"UNorm8" A"Normalized wire values 0..1; stored as unsigned 8-bit 0..255."',
    )
    expect( output ).toContain(
      `D-50 R${GGGGXEnumGroupIndex.Operator} L"ggggx.operator" S58 T"enum"`,
    )
    expect( output ).toContain(
      `D-51 R${GGGGXEnumGroupIndex.Operator} V2 L"add" A"Add: current + incoming."`,
    )
    expect( output ).toContain(
      `D-51 R${GGGGXEnumGroupIndex.Operator} V44 L"hypot" A"Euclidean norm of current and incoming."`,
    )
    expect( output ).toContain(
      `D-51 R${GGGGXEnumGroupIndex.Operator} V57 L"atanh"`,
    )
    expect( output ).toContain(
      `D-50 R${GGGGXEnumGroupIndex.Transform} L"ggggx.transform" S4 T"enum"`,
    )
    expect( output ).toContain(
      `D-51 R${GGGGXEnumGroupIndex.Transform} V3 L"offset"`,
    )
    expect( output ).toContain(
      `D-50 R${GGGGXEnumGroupIndex.MatrixRegister} L"ggggx.register" S1 T"reference"`,
    )
    expect( output ).toContain(
      `D-51 R${GGGGXEnumGroupIndex.MatrixRegister} V0 L"r"`,
    )
    expect( output.endsWith( "OK\n" ) ).toBe( true )
  } )

  test( "D1 describes basics, commands, then enums with one terminator", async () => {
    const output = await run( protocolMachine(), "D1" )

    expect( output ).toContain( 'D-20 L"argument.form"' )
    expect( output ).toContain( 'D-40 B"D4"' )
    expect( output ).toContain(
      `D-50 R${GGGDXEnumGroupIndex.CommandResultRecord} L"CommandResultRecord"`,
    )
    expect( output.indexOf( "\nD-20 " ) ).toBeLessThan( output.indexOf( "\nD-40 " ) )
    expect( output.indexOf( "\nD-40 " ) ).toBeLessThan( output.indexOf( "\nD-50 " ) )
    expect( output.match( /^OK$/gm ) ).toHaveLength( 1 )
  } )
} )
