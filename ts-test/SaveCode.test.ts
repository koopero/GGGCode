import ggggxBuffer from "../ts/ggggx/ggggxBuffer"
import { GGG } from "../ts/ggg/gggLang"
import { ggggxCodes } from "../ts/ggggx/ggggxLang"
import gggFormat from "../ts/ggg/gggFormat"

describe("ggggxBuffer", () => {
  test("saveCode", () => {
    const name = "Test"
    const index = 2
    const dim = [ 2, 3 ]
    const data = [1,2,3,4,5,6] 
    const chunk = 3
    const buffer = new ggggxBuffer( { dim, name, index } )
    buffer.write( data )

    const lines = buffer.saveCode( { chunk }  )
    const codes = lines.map( ( line ) => gggFormat( line ) )
    const [ header, data0, data1 ] = codes
    const register = `${GGG.Register}${index}`
    expect( header ).toEqual( `${ggggxCodes.NumbersInit} ${register} ${GGG.Alias}"${name}" ${GGG.Size}${dim} ${GGG.Storage}"Array"` )
    expect( data0 ).toEqual( `${ggggxCodes.WriteBuffer} ${register} ${GGG.Offset}${0} ${GGG.Data}${data.slice(0,chunk)}` )
    expect( data1 ).toEqual( `${ggggxCodes.WriteBuffer} ${register} ${GGG.Offset}${chunk} ${GGG.Data}${data.slice(chunk)}` )
  })
})

