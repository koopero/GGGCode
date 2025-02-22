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