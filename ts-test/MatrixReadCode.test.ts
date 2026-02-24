import Matrix from "../ts/ggg/Matrix"
import { GGG } from "../ts/ggg/Language"
import { GXCommandNames as GX } from "../ts/ggggx/GXLanguage"
import { MatrixReadCode } from "../ts/ggggx/MatrixRead"
import Format from "../ts/ggg/Format"
import { Ops } from "../ts/ggggx/Operators"

describe("MatrixReadCode", () => {
  test("saveCode", () => {
    const name = "Test"
    const index = 2
    const dim = [ 2, 3 ]
    const data = [1,2,3,4,5,6] 
    const chunk = 3
    const buffer = new Matrix( { dim, name, index } )
    buffer.write( data )

    const gen = MatrixReadCode( buffer, { chunk }  )
    const lines = Array.from( gen )
    const codes = lines.map( ( line ) => Format( line ) )
    const [ header, data0, data1 ] = codes
    const register = `${GGG.Register}${index}`
    const operator = `${GGG.Operator}"${Ops.set}"`
    expect( header ).toEqual( `${GX.MatrixInit} ${register} ${GGG.Alias}"${name}" ${GGG.Size}${dim} ${GGG.Storage}"Array"` )
    expect( data0 ).toEqual( `${GX.MatrixWrite} ${register} ${operator} ${GGG.Offset}${0} ${GGG.Data}${data.slice(0,chunk)}` )
    expect( data1 ).toEqual( `${GX.MatrixWrite} ${register} ${operator} ${GGG.Offset}${chunk} ${GGG.Data}${data.slice(chunk)}` )
  })
})

