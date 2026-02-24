import { floor, saturate, abs, max, min } from "../common/math"
import { GGG, UnitaryNames, HexEncodings } from "./Language"
import { Described } from "./Language"
import NamedList, { NamedListItem } from "./NamedList"

type EncodingType = NamedListItem & Described & {

}

enum EncodingIndexes {
  EncodedZero = 0,
  Data = 1,
  Dimension = 10,
  HexNumber = 16,
  HexNorm2 = 255,
  HexNorm1 = 22,
  HexList2 = 23,
  HexList1 = 24,
}

const EncodingDefault = { name: GGG.Data, index: EncodingIndexes[GGG.Data], description: "Decimal" }

const EncodingList = new NamedList<EncodingType>( [
  EncodingDefault,
  { name: GGG.Dimension, index: EncodingIndexes[GGG.Dimension], description: "Integer" },
  { name: GGG.EncodedOne, index: EncodingIndexes[GGG.EncodedOne], description: "Unitary" },
  { name: HexEncodings.HexNumber, index: EncodingIndexes[HexEncodings.HexNumber], description: "Hex" },
  { name: HexEncodings.HexNorm2, index: EncodingIndexes[HexEncodings.HexNorm2], description: "HexNorm2" },
  { name: HexEncodings.HexNorm1, index: EncodingIndexes[HexEncodings.HexNorm1], description: "HexNorm1" },
  { name: HexEncodings.HexList2, index: EncodingIndexes[HexEncodings.HexList2], description: "HexList2" },
  { name: HexEncodings.HexList1, index: EncodingIndexes[HexEncodings.HexList1], description: "HexList1" },
] )

export function EncodingCode( code:string|number ) {
  const encoding = EncodingList.get( code ) || EncodingDefault
  return encoding.name
}


function representHex ( digits:number, normal:boolean ) {
  if ( normal ) {
    return ( value:number, allowQuantize:number ) => {
      let quant = floor( saturate( value ) * (16 ** digits - 1) ) / (16 ** digits - 1)
      return abs( value - quant ) <= allowQuantize
    }
  } else {
    const maxValue = 16 ** digits - 1
    return ( value:number, allowQuantize:number ) => {
      let quant = max( 0, min( maxValue, floor( value ) ) )
      return abs( value - quant ) <= allowQuantize
    }
  }
}

function respresentUnitary() {
  return ( value:number ) => value == 0 || value == 1 || value == -1
}

const HexOverhead = 2

const EncodingShortestOptions = [ 
  { name: UnitaryNames.Zero, overhead: 0, canRepresent: respresentUnitary() },
  { name: HexEncodings.HexList1, overhead: HexOverhead, canRepresent: representHex( 1, false ) },
  { name: HexEncodings.HexNorm1, overhead: HexOverhead, canRepresent: representHex( 1, true ) },
  { name: HexEncodings.HexList2, overhead: HexOverhead, canRepresent: representHex( 1, false ) },
  { name: HexEncodings.HexNorm2, overhead: HexOverhead, canRepresent: representHex( 1, true ) },
  { name: GGG.Data, overhead: 1, canRepresent: () => true },
]


export function EncodingShortest( values:number[], allowQuantize:number = 0 ) {
  const list = EncodingShortestOptions
  let working = list.map( ( option, index ) => index )

  for ( const value of values ) {
    working = working.filter( option => {
      const encoding = list[ option]
      return encoding.canRepresent( value, allowQuantize )
    } )
  } 
}