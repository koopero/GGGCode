import { floor, saturate, abs, max, min } from "../common/math"
import { GGG } from "./gggLang"
import { gggDescribed } from "./gggLang"
import gggNamedList, { gggNamedListItem } from "./NamedList"

type EncodingType = gggNamedListItem & gggDescribed & {

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

const EncodingList = new gggNamedList<EncodingType>( [
  EncodingDefault,
  { name: GGG.Dimension, index: EncodingIndexes[GGG.Dimension], description: "Integer" },
  { name: GGG.EncodedZero, index: EncodingIndexes[GGG.EncodedZero], description: "Unitary" },
  { name: GGG.HexNumber, index: EncodingIndexes[GGG.HexNumber], description: "Hex" },
  { name: GGG.HexNorm2, index: EncodingIndexes[GGG.HexNorm2], description: "HexNorm2" },
  { name: GGG.HexNorm1, index: EncodingIndexes[GGG.HexNorm1], description: "HexNorm1" },
  { name: GGG.HexList2, index: EncodingIndexes[GGG.HexList2], description: "HexList2" },
  { name: GGG.HexList1, index: EncodingIndexes[GGG.HexList1], description: "HexList1" },
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
  { name: GGG.EncodedZero, overhead: 0, canRepresent: respresentUnitary() },
  { name: GGG.HexList1, overhead: HexOverhead, canRepresent: representHex( 1, false ) },
  { name: GGG.HexNorm1, overhead: HexOverhead, canRepresent: representHex( 1, true ) },
  { name: GGG.HexList2, overhead: HexOverhead, canRepresent: representHex( 1, false ) },
  { name: GGG.HexNorm2, overhead: HexOverhead, canRepresent: representHex( 1, true ) },
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