import { gggHooks, Machine, Format, ParseArg } from "../ts/index"


describe("README", () => {
  describe("Unitary constants", () => {
    test("ASCII constants: K=1, Z=0, N=-1", () => {
      expect( ParseArg("VK")?.[0]?.data ).toEqual([1])
      expect( ParseArg("VZ")?.[0]?.data ).toEqual([0])
      expect( ParseArg("VN")?.[0]?.data ).toEqual([-1])
    })

    test("ASCII constants are case-insensitive", () => {
      expect( ParseArg("Vk")?.[0]?.data ).toEqual([1])
      expect( ParseArg("Vz")?.[0]?.data ).toEqual([0])
      expect( ParseArg("Vn")?.[0]?.data ).toEqual([-1])
    })

    test("unicode math constants", () => {
      expect( ParseArg("Vπ")?.[0]?.data ).toEqual([Math.PI])
      expect( ParseArg("Vτ")?.[0]?.data ).toEqual([Math.PI * 2])
      expect( ParseArg("Ve")?.[0]?.data ).toEqual([Math.E])
    })

    test("unitary constants in a range: N:K", () => {
      const [ token ] = ParseArg("RN:K")
      expect( token ).toMatchObject({
        code: "R",
        data: [{ start: -1, end: 1, inclusive: true }],
      })
    })
  })

  describe("Open ranges", () => {
    test("open range: 0:", () => {
      const [ token ] = ParseArg("R0:")
      expect( token ).toMatchObject({
        code: "R",
        data: [{ start: 0, end: NaN, inclusive: true }],
      })
    })

    test("open range with count: 0:/4", () => {
      const [ token ] = ParseArg("R0:/4")
      expect( token ).toMatchObject({
        code: "R",
        data: [{ start: 0, end: NaN, count: 4, inclusive: true }],
      })
    })

    test("open range using unitary constant: π:", () => {
      const [ token ] = ParseArg("Rπ:")
      expect( token ).toMatchObject({
        code: "R",
        data: [{ start: Math.PI, end: NaN, inclusive: true }],
      })
    })
  })


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
    
    const machine = new Machine( { commands } )
    
    machine.run( "P0 S0")
    .then( result => {
      result = Format( result )
      expect( result ).toBe( "; Hello\nOK\n" )
    })
  })
})