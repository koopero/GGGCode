import { gggHooks, gggMachine, Format } from "../ts/index"


describe("README", () => {
  test("First example", async () => {
    const commands = {
      "P0": {
        description: "Print a string to output",
        [gggHooks.Value]: ( arg ) => {
          const { machine, code, value } = arg
          switch ( code ) {
            case "S":
              const strings = ["Hello","World!"]
              const string = strings[value]
              if ( string ) {
                machine.output( { comment: string } )
              }
            break
          }
        },
        [gggHooks.End]: ( arg ) => {
          const { machine } = arg
          machine.outputOk()
        }
      }
    }
    
    const machine = new gggMachine( { commands } )
    
    machine.run( "P0 S0")
    .then( result => {
      result = Format( result )
      expect( result ).toBe( "; Hello\nOK\n" )
    })
  })
})