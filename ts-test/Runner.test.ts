import Machine from "../ts/ggg/Machine"
import { Runner } from "../ts/stream/Runner"
import BuiltinCommands from "../ts/builtin"

describe("Runner", () => {
  test("will not smork", async () => {
    const machine = new Machine( { commands: BuiltinCommands } )
    const runner = new Runner( { machine } )
    // runner.run("D1\n")

    const result = await runner.run(`P10 A16 B0xFF C1:10\n`)
    expect( result ).toBeDefined()

    expect( runner ).toBeDefined()
    expect( runner.running ).toBeNull()
  })
})