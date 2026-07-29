import { existsSync, readFileSync, readdirSync } from "fs"
import { basename, dirname, resolve } from "path"
import Format from "../ts/ggg/Format"
import Machine from "../ts/ggg/Machine"
import { commandsFor } from "../ts/cxx/conformance"

const root = resolve( __dirname, ".." )
const handWritten = [
  "README.md",
  "docs/tour.md",
  "docs/runtime.md",
  "docs/protocol.md",
]

function gggBlocks( markdown:string ) {
  return [ ...markdown.matchAll( /```ggg[^\n]*\n([\s\S]*?)```/g ) ]
    .map( match => match[1].trim() )
}

function headingSlug( value:string ) {
  return value
    .trim()
    .toLowerCase()
    .replace( /<[^>]*>/g, "" )
    .replace( /[`*~]/g, "" )
    .replace( /[^\p{L}\p{N}_ -]/gu, "" )
    .replace( / /g, "-" )
}

function markdownAnchors( file:string ) {
  const counts:Record<string,number> = {}
  const anchors = new Set<string>()
  for ( const line of readFileSync( file, "utf8" ).split( /\r?\n/ ) ) {
    const match = line.match( /^#{1,6}\s+(.+?)\s*#*$/ )
    if ( !match ) continue
    const base = headingSlug( match[1] )
    const count = counts[base] || 0
    counts[base] = count + 1
    anchors.add( count ? `${base}-${count}` : base )
  }
  return anchors
}

function tableColumnCount( line:string ) {
  let separators = 0
  for ( let index = 0; index < line.length; index++ ) {
    if ( line[index] !== "|" ) continue
    let slashes = 0
    for ( let before = index - 1; before >= 0 && line[before] === "\\"; before-- )
      slashes++
    if ( slashes % 2 === 0 ) separators++
  }
  return separators - 1
}

describe( "documentation", () => {
  test( "hand-written GGG examples execute without a failure response", async () => {
    const commands = commandsFor( [ "gggpx", "gggtx", "ggggx", "gggdx" ] )
    let count = 0

    for ( const relative of handWritten ) {
      const markdown = readFileSync( resolve( root, relative ), "utf8" )
      for ( const source of gggBlocks( markdown ) ) {
        count++
        const machine = new Machine( { commands } )
        const output = await machine.run( source )
        const wire = output.map( token => Format( token ) ).join( "" )
        expect( {
          file: relative,
          source,
          wire,
          failed: /^O\S*\s+F-?\d+/m.test( wire ),
        } ).toMatchObject( { failed: false } )
      }
    }

    expect( count ).toBeGreaterThan( 15 )
  } )

  test( "all local Markdown links and anchors resolve", () => {
    const files = [
      resolve( root, "README.md" ),
      ...readdirSync( resolve( root, "docs" ) )
        .filter( name => name.endsWith( ".md" ) )
        .map( name => resolve( root, "docs", name ) ),
    ]
    const anchors = new Map( files.map( file => [ file, markdownAnchors( file ) ] ) )
    const missing:string[] = []

    for ( const file of files ) {
      const markdown = readFileSync( file, "utf8" )
      for ( const match of markdown.matchAll( /!?\[[^\]]*]\(([^)]+)\)/g ) ) {
        const raw = match[1].trim().replace( /^<|>$/g, "" )
        if ( /^(https?:|mailto:)/.test( raw ) ) continue
        const hash = raw.indexOf( "#" )
        const pathPart = hash === -1 ? raw : raw.slice( 0, hash )
        const anchor = hash === -1 ? "" : decodeURIComponent( raw.slice( hash + 1 ) )
        const target = resolve(
          dirname( file ),
          decodeURIComponent( pathPart || basename( file ) ),
        )
        if ( pathPart && !existsSync( target ) ) {
          missing.push( `${file}: missing ${raw}` )
        } else if ( anchor && target.endsWith( ".md" ) ) {
          const targetAnchors = anchors.get( target )
          if ( targetAnchors && !targetAnchors.has( anchor ) )
            missing.push( `${file}: missing anchor ${raw}` )
        }
      }
    }

    expect( missing ).toEqual( [] )
  } )

  test( "Markdown table rows have consistent column counts", () => {
    const files = [
      resolve( root, "README.md" ),
      ...readdirSync( resolve( root, "docs" ) )
        .filter( name => name.endsWith( ".md" ) )
        .map( name => resolve( root, "docs", name ) ),
    ]
    const malformed:string[] = []

    for ( const file of files ) {
      const lines = readFileSync( file, "utf8" ).split( /\r?\n/ )
      let expected:number | undefined
      for ( let index = 0; index < lines.length; index++ ) {
        const line = lines[index]
        if ( !line.startsWith( "|" ) ) {
          expected = undefined
          continue
        }
        const columns = tableColumnCount( line )
        if ( expected === undefined ) expected = columns
        else if ( columns !== expected )
          malformed.push(
            `${file}:${index + 1}: expected ${expected} columns, found ${columns}`,
          )
      }
    }

    expect( malformed ).toEqual( [] )
  } )

  test( "published GGG example files execute without a failure response", async () => {
    const commands = commandsFor( [ "gggpx", "gggtx", "ggggx", "gggdx" ] )
    const examples = readdirSync( resolve( root, "example" ) )
      .filter( name => /\.gggx?$/.test( name ) )

    expect( examples.length ).toBeGreaterThanOrEqual( 3 )
    for ( const name of examples ) {
      const machine = new Machine( { commands } )
      const source = readFileSync( resolve( root, "example", name ), "utf8" )
      const output = await machine.run( source )
      const wire = output.map( token => Format( token ) ).join( "" )
      expect( {
        name,
        wire,
        failed: /^O\S*\s+F-?\d+/m.test( wire ),
      } ).toMatchObject( { failed: false } )
    }
  }, 60_000 )

  test( "the npm package carries its linked docs, examples, and C++ headers", () => {
    const packageJson = JSON.parse( readFileSync( resolve( root, "package.json" ), "utf8" ) )
    expect( packageJson.files ).toEqual( expect.arrayContaining( [
      "docs/",
      "example/",
      "cxx/include/",
    ] ) )
  } )

  test( "the displayed C++ quickstart is the compiled example source", () => {
    const guide = readFileSync( resolve( root, "docs/cxx.md" ), "utf8" )
    const displayed = guide.match( /```cpp\n([\s\S]*?)```/ )?.[1].trim()
    const compiled = readFileSync( resolve( root, "example/cxx_minimal.cpp" ), "utf8" ).trim()
    expect( displayed ).toBe( compiled )
  } )
} )
