import { resolve } from "path"
import { mkdir } from "fs/promises"
import { writeFile } from "fs/promises"

async function ensureDir(dir) {
  try {
    await mkdir(dir, { recursive: true })
  } catch (error) {
    if (error.code !== 'EEXIST') {
      throw error; // rethrow the error if it's not related to the existence of the directory
    }
  }
}

const resolveToOutput = ( path:string ) => resolve( __dirname, "../ts-test-output/", path )

export async function writeToTestOutput( path:string, data:Buffer|Uint8Array ) {
  await ensureDir( resolveToOutput( "." ) )
  path = resolveToOutput( path )
  return writeFile( path, data )
}

export async function writeDocsFiles( code:string, name:string ) {
  await writeToTestOutput( `docs-${name}.ggg`, Buffer.from( code ) )
}

import { spawn, StdioOptions } from "child_process"

export async function testCxxMachine( program:string ) : Promise<string> {
  const command = "cling"
  const options = { cwd: resolve( __dirname, ".." ), stdio: "pipe" as StdioOptions }
  const args = [ "-std=c++17", "-x", "c++", "cpp/cling/testMachine.C" ]

  let stderr = ""
  let result = ""
  return await new Promise( (resolve, reject) => {
    // console.log('spawn', `${command} ${args.join(" ")}`) 
    const proc = spawn( command, args, options )

    proc.stdout?.on( "data", data => result += data.toString() )
    proc.stderr?.on( "data", data => process.stderr.write( data.toString() ) )

    // proc.stdout?.on( "data", data => trace && console.log( data.toString() ) )
    proc.stdin?.write( program )
    proc.stdin?.end()

    proc.on( "error", reject )
    proc.on( "exit", code => {
      if ( code === 0 ) {
        resolve( result )
      } else {
        reject( new Error( `Process exited with code ${code}` ) )
      }
    })
  })

  if ( stderr ) {
    console.error( stderr )
  }
}