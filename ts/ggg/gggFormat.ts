import { isString, isObject, isArray, isDefined, isBoolean, isNumber } from "../common/util"
import { floor } from "../common/math"
import { GGG, gggPrimitive, gggCasedString, gggToken } from "./gggLang"
import { HexModifiers } from "./hexlist"

function formatHexListItem( num, digits:number = 2, div:number = 1 ) {
  if ( !isNumber( num ) ) {
    throw new Error(`Cannot format non-number as hex list: ${num}`)
  }
  num = floor( num * div )
  const max = Math.pow( 16, digits ) - 1
  num = num < 0 ? 0 : num > max ? max : num
  return num.toString(16).padStart( digits, "0" )
}

function formatHexNumber( num:number ) {
  return `0${GGG.HexNumber}${num.toString(16)}`
}

export function gggFormatPrimitive( data:gggPrimitive ) : string {
  if ( isString( data ) ) {
    return JSON.stringify( data )
  }

  if ( isBoolean( data ) ) {
    data = data ? "1" : "0"
  }

  if ( isNumber( data ) ) {
    return data.toString()
  }

  throw new Error(`Invalid data: ${data}`)
}


export function gggFormatData( data:string|number|boolean|gggPrimitive|gggPrimitive[], encoding:string = "" ) : string {
  if ( isString( data ) ) {
    return gggFormatPrimitive( data )
  }

  if ( isBoolean( data ) ) {
    data = data ? 1 : 0
  }

  if ( !isArray( data ) ) {
    data = [ data ]
  }

  encoding = gggCasedString( encoding )

  switch ( encoding ) {
    case GGG.HexNumber:
      return data.map( d => isNumber(d) ? formatHexNumber( d ) : gggFormatPrimitive( d ) ).join(GGG.Comma)

    case GGG.HexList1:
    case GGG.HexList2:
    case GGG.HexNorm1:
    case GGG.HexNorm2: {
      const { digits, div } = HexModifiers[ encoding ]
      return `0${encoding}`+data.map( d => isNumber( d ) ? formatHexListItem( d, digits, div ) : "" ).join("")
    }

    case GGG.EncodedMinusOne:
    case GGG.EncodedZero:
    case GGG.EncodedOne:
      return data.map( d => !isNumber( d ) ? "" : d > 0 ? GGG.EncodedOne : d < 0 ? GGG.EncodedMinusOne : GGG.EncodedZero ).join("")


    case "":
    case GGG.Value:
      return data.map( d => gggFormatPrimitive(d) ).join(GGG.Comma)
  }

  throw new Error(`Invalid encoding: ${encoding}`)
}

// type gggFormatToken = string | {
//   command?: string,
//   code?: string,
//   encoding?: string,
//   args?: gggFormatToken[],
//   data?: any,
//   comment?: string,
// } | gggFormatToken[]

export type gggFormatProps = string | gggToken | string[] | gggToken[]

export default function gggFormat( token : gggFormatProps = "" ) {
  if ( isString( token ) ) {
    return token
  }

  if ( isArray( token ) ) {
    return token.map( t => gggFormat( t ) ).join("\n")+"\n"
  }

  if ( isObject( token ) ) {
    const { 
      code,
      command,
      encoding, 
      args, 
      data, 
      comment,
    } = token


    let result = command || ""
    if ( code ) {
      if ( result ) result += " "
      result += code
    }

    if ( isDefined( data ) ) {
      result += gggFormatData( data, encoding )
    }

    if ( args ) {
      if ( result ) result += " "
      result += args.map( t => gggFormat( t ) ).join(" ")
    }

    if ( comment ) {
      if ( !comment.startsWith(";") ) result += "; "
      result += comment
    }

    return result
  }

  return ""
}

export function gggFormatOkayNumber( num:number ) {
  switch ( num ) {
    case 0: return GGG.EncodedZero
    case 1: return GGG.EncodedOne
    case -1: return GGG.EncodedMinusOne
    default: return floor(num).toString()
  }
}