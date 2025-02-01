import { RegionsAdd } from "../ts/ggggx/Regions"


describe("RegionsAdd", () => {
  test("will add from nothing", async () => {
    const regions = RegionsAdd( [0,4] )
    expect( regions ).toEqual( [ [0,4] ] )
  })

  test("will append at end", async () => {
    const regions = RegionsAdd( [5,8],  [ [0,4] ] )
    expect( regions ).toEqual( [ [0,4],[5,8] ] )
  })

  test("will append at start", async () => {
    const regions = RegionsAdd( [0,4],  [[5,8]] )
    expect( regions ).toEqual( [ [0,4],[5,8] ] )
  })

  test("will bridge", async () => {
    const regions = RegionsAdd( [3,6],  [[0,4],[5,8]] )
    expect( regions ).toEqual( [ [0,8] ] )
  })
})


