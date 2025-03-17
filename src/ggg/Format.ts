import { isString, isObject, isArray, isDefined, isBoolean, isNumber } from "../common/util"
import { floor } from "../common/math"
import { GGG, gggPrimitive, gggCasedString, gggToken, gggRangeAxis, gggRangeAxes, gggReference } from "./gggLang"
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

export function FormatNumber( data:number, encoding? ) {
  return data.toString()
}

export function FormatRangeAxes( data:gggRangeAxes ) : string {
  return data.axes.map( a => FormatRangeAxis( a ) ).join(GGG.NextAxis)
}

export function FormatReference( data:gggReference ) : string {
  let { register, subscript } = data

  return `${GGG.Reference}${register}[${FormatData(subscript)}]`
}

export function FormatRangeAxis( data:gggRangeAxis ) : string {
  const { 
    start,
    end,
    step,
    count,
    multiplier,
    inclusive,
  } = data
  let result = ""

  result += FormatNumber( start )

  if ( inclusive ) {
    result += GGG.Range
  } else {
    result += GGG.Uninclusive
  }

  result += FormatNumber( end )

  if ( step ) {
    result += GGG.Range
    result += FormatNumber( step )
  } else if ( count ) {
    result += GGG.Count
    result += FormatNumber( count )
  }

  if ( isDefined( multiplier ) ) {
    result += GGG.Multiplier
    result += FormatNumber( multiplier )
  }

  return result
}

export function FormatPrimitive( data:gggPrimitive ) : string {
  if ( isString( data ) ) {
    return JSON.stringify( data )
  }

  if ( isBoolean( data ) ) {
    data = data ? "1" : "0"
  }

  if ( isNumber( data ) ) {
    return data.toString()
  }

  if ( isObject( data ) ) {
    if ( "value" in data ) {
      return FormatPrimitive( data.value )
    } else if ( "axes" in data ) {
      return FormatRangeAxes( data )
    } else if ( "register" in data ) {
      return FormatReference( data )
    } else {
      return FormatRangeAxis( data )
    }
  }

  throw new Error(`Invalid data: ${data}`)
}


export function FormatData( data:string|number|boolean|gggPrimitive|gggPrimitive[], encoding:string = "" ) : string {
  if ( isString( data ) ) {
    return FormatPrimitive( data )
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
      return data.map( d => isNumber(d) ? formatHexNumber( d ) : FormatPrimitive( d ) ).join(GGG.Comma)

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
      return data.map( d => FormatPrimitive(d) ).join(GGG.Comma)
  }

  throw new Error(`Invalid encoding: ${encoding}`)
}

// type FormatToken = string | {
//   command?: string,
//   code?: string,
//   encoding?: string,
//   args?: FormatToken[],
//   data?: any,
//   comment?: string,
// } | FormatToken[]

export type FormatProps = string | gggToken | string[] | gggToken[]

export default function Format( token : FormatProps = "" ) {
  if ( isString( token ) ) {
    return token
  }

  if ( isArray( token ) ) {
    return token.map( t => Format( t ) ).join("\n")+"\n"
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
      result += FormatData( data, encoding )
    }

    if ( args ) {
      if ( result ) result += " "
      result += args.map( t => Format( t ) ).join(" ")
    }

    if ( comment ) {
      if ( !comment.startsWith(";") ) result += "; "
      result += comment
    }

    return result
  }

  return ""
}

export function FormatOkayNumber( num:number ) {
  switch ( num ) {
    case 0: return GGG.EncodedZero
    case 1: return GGG.EncodedOne
    case -1: return GGG.EncodedMinusOne
    default: return floor(num).toString()
  }
}