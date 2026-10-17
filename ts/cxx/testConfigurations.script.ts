import {
  mkdtempSync,
  readFileSync,
  rmSync,
} from "fs"
import { tmpdir } from "os"
import { join, resolve } from "path"
import { spawnSync } from "child_process"

const root = resolve( __dirname, "../.." )
const source = resolve( root, "cxx/test-config/config_probe.cpp" )
const docsSource = resolve( root, "example/cxx_minimal.cpp" )
const include = resolve( root, "cxx/include" )
const temp = mkdtempSync( join( tmpdir(), "ggg-config-" ) )

type Scenario = {
  name:string,
  definitions:Record<string,number>,
  commands:number,
  forbidden?:string[],
}

const scenarios:Scenario[] = [
  {
    name: "default",
    definitions: {},
    commands: 15,
  },
  {
    name: "minimal",
    definitions: {
      GGGPX_ENABLE: 0,
      GGGGX_ENABLE: 0,
      GGGTX_ENABLE: 0,
      GGGDX_ENABLE: 0,
    },
    commands: 0,
    forbidden: [
      "Write values into a register.",
      "Describe the language.",
      "Define a procedure",
    ],
  },
  {
    name: "print-only",
    definitions: {
      GGGPX_ENABLE: 1,
      GGGGX_ENABLE: 0,
      GGGTX_ENABLE: 0,
      GGGDX_ENABLE: 0,
    },
    commands: 2,
  },
  {
    name: "no-doc-no-cordic",
    definitions: {
      GGGPX_ENABLE: 1,
      GGGGX_ENABLE: 1,
      GGGTX_ENABLE: 1,
      GGGDX_ENABLE: 0,
      GGGGX_CORDIC_ENABLE: 0,
    },
    commands: 10,
    forbidden: [
      "Write values into a register.",
      "Describe the language.",
    ],
  },
  {
    name: "graphics-doc-no-trig",
    definitions: {
      GGGPX_ENABLE: 0,
      GGGGX_ENABLE: 1,
      GGGTX_ENABLE: 0,
      GGGDX_ENABLE: 1,
      GGGGX_TRIG_ENABLE: 0,
    },
    commands: 8,
  },
  {
    name: "docs-only",
    definitions: {
      GGGPX_ENABLE: 0,
      GGGGX_ENABLE: 0,
      GGGTX_ENABLE: 0,
      GGGDX_ENABLE: 1,
    },
    commands: 5,
    forbidden: [
      "Matrix storage representations.",
      "G40 transform modes.",
      "Live procedure register",
      "ProcedureNotFound",
      "BlitFailed",
    ],
  },
]

try {
  for ( const scenario of scenarios ) {
    const binary = join( temp, scenario.name )
    const definitions = {
      ...scenario.definitions,
      GGG_CONFIG_EXPECT_COMMANDS: scenario.commands,
    }
    const args = [
      "-std=c++17",
      "-Os",
      "-I", include,
      ...Object.entries( definitions ).map( ( [ name, value ] ) =>
        `-D${name}=${value}`
      ),
      source,
      "-o", binary,
    ]
    const compile = spawnSync( "c++", args, { encoding: "utf8" } )
    if ( compile.status !== 0 )
      throw new Error( `${scenario.name} compile failed:\n${compile.stderr}` )

    const run = spawnSync( binary, [], { encoding: "utf8" } )
    if ( run.status !== 0 )
      throw new Error( `${scenario.name} probe failed with status ${run.status}` )

    const image = readFileSync( binary )
    for ( const forbidden of scenario.forbidden || [] ) {
      if ( image.includes( Buffer.from( forbidden ) ) )
        throw new Error( `${scenario.name} retained disabled string: ${forbidden}` )
    }
  }

  // Keep the public C++ quickstart honest by compiling and executing the exact
  // source linked from docs/cxx.md.
  const docsBinary = join( temp, "docs-example" )
  const docsCompile = spawnSync( "c++", [
    "-std=c++17",
    "-Os",
    "-I", include,
    docsSource,
    "-o", docsBinary,
  ], { encoding: "utf8" } )
  if ( docsCompile.status !== 0 )
    throw new Error( `C++ docs example compile failed:\n${docsCompile.stderr}` )

  const docsRun = spawnSync( docsBinary, [], { encoding: "utf8" } )
  if ( docsRun.status !== 0 )
    throw new Error( `C++ docs example failed with status ${docsRun.status}` )
  if ( docsRun.stdout !== "V1,2,3\nOK\n" )
    throw new Error( `C++ docs example output changed: ${JSON.stringify( docsRun.stdout )}` )

  console.log(
    `C++ configuration probes passed (${scenarios.length} feature builds + docs example).`
  )
} finally {
  rmSync( temp, { recursive: true, force: true } )
}
