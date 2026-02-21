import { isString, isObject, isArray, isDefined, isBoolean, isNumber } from "../common/util"
import { floor } from "../common/math"
import { GGG, gggPrimitive, gggCasedString, gggToken, gggRangeAxis, gggRangeAxes, gggReference, UnitaryNames } from "./gggLang"
import { HexModifiers } from "./hexlist"



type EncodingArg = string
const EncodingDefault = ""

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

export function FormatNumber( data:number, encoding?:EncodingArg ) : string {
  switch ( encoding ) {
    case GGG.HexNumber:
      return formatHexNumber( data )

    default:
      return data.toString()
  }
}

export function FormatNumberFirst( data:number, encoding?:EncodingArg ) : string {
  switch ( encoding ) {
    case GGG.HexList1:
    case GGG.HexList2:
    case GGG.HexNorm1:
    case GGG.HexNorm2:
      const { digits, div } = HexModifiers[ encoding ]
      return `0${encoding}` + formatHexListItem( data, digits, div )

    default:
      return FormatNumber( data, encoding )
  }
}

export function FormatNumberSubsequent( data:number, encoding?:EncodingArg ) : string {
  switch ( encoding ) {
    case GGG.HexList1:
    case GGG.HexList2:
    case GGG.HexNorm1:
    case GGG.HexNorm2:
      const { digits, div } = HexModifiers[ encoding ]
      return formatHexListItem( data, digits, div )

    default:
      return GGG.Comma + FormatNumber( data, encoding )
  }
}

export function FormatRangeAxes( data:gggRangeAxes, encoding?:EncodingArg ) : string {
  return data.axes.map( a => FormatRangeAxis( a, encoding ) ).join(GGG.NextAxis)
}

export function FormatReference( data:gggReference ) : string {
  let { register, subscript } = data

  return `${GGG.Reference}${register}[${FormatData(subscript)}]`
}

export function FormatRangeAxis( data:gggRangeAxis, encoding?:EncodingArg ) : string {
  const { 
    start,
    end,
    step,
    count,
    multiplier,
    inclusive,
  } = data
  let result = ""

  result += FormatNumber( start, encoding )

  if ( inclusive ) {
    result += GGG.Range
  } else {
    result += GGG.Uninclusive
  }

  result += FormatNumber( end, encoding )

  if ( step ) {
    result += GGG.Range
    result += FormatNumber( step, encoding )
  } else if ( count ) {
    result += GGG.Count
    result += FormatNumber( count, encoding )
  }

  if ( isDefined( multiplier ) ) {
    result += GGG.Multiplier
    result += FormatNumber( multiplier, encoding )
  }

  return result
}

export function FormatPrimitive( data:gggPrimitive, encoding:EncodingArg = EncodingDefault ) : string {
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


export function FormatData( data:undefined|string|number|boolean|gggPrimitive|gggPrimitive[], encoding:EncodingArg = EncodingDefault ) : string {
  if ( !isDefined( data ) ) {
    return ""
  }

  if ( isString( data ) ) {
    return FormatPrimitive( data )
  }

  if ( isBoolean( data ) ) {
    data = data ? 1 : 0
  }

  if ( !isArray( data ) ) {
    data = [ data ]
  }

  if ( !data || !data.length ) {
    return ""
  }

  encoding = gggCasedString( encoding )

  if ( isArray( data ) ) {
    switch ( encoding ) {
      case GGG.HexList1:
      case GGG.HexList2:
      case GGG.HexNorm1:
      case GGG.HexNorm2: {
        const { digits, div } = HexModifiers[ encoding ]
        return `0${encoding}`+data.map( d => isNumber( d ) ? formatHexListItem( d, digits, div ) : "" ).join("")
      }

      case UnitaryNames.MinusOne:
      case UnitaryNames.Zero:
      case UnitaryNames.One:
        return data.map( d => !isNumber( d ) ? "" : d > 0 ? UnitaryNames.One : d < 0 ? UnitaryNames.MinusOne : UnitaryNames.Zero ).join("")


      case "":
      case GGG.Value:
        return data.map( d => FormatPrimitive(d, encoding ) ).join(GGG.Comma)
    }

    throw new Error(`Invalid encoding: ${encoding}`)
  }
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
    case 0: return UnitaryNames.Zero
    case 1: return UnitaryNames.One
    case -1: return UnitaryNames.MinusOne
    default: return floor(num).toString()
  }
}