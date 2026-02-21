import { GGG, gggCasedString, gggPrimitive, gggRangeAxis, gggReference, ParseOptions, UnitaryNames, UnitaryValues } from "./gggLang"
import { HexModifiers, HexModifier } from "./hexlist"


const hexPrefixCodes = GGG.HexList1 + GGG.HexList2 + GGG.HexNorm1 + GGG.HexNorm2 + GGG.HexNumber
const hexNumberPattern = `^0[${hexPrefixCodes}][0-9a-f]+`
const hexNumber = new RegExp( hexNumberPattern, "i" )
const decimalNumber = /^[+-]?(\d+(\.\d+)?)([Ee][+-]?\d+)?/
const doubleQuotedString = /^((""|".*?[^\\]"))/

const RegexEscape = ( str:string ) => str.replace( /[-\/\\^$*+?.()|[\]{}]/g, '\\$&' )
const referenceReg = new RegExp( `^${RegexEscape(GGG.Reference)}([a-zA-Z0-9_]*)(${RegexEscape(GGG.Subscript)}?)` )

const unitaryPattern = new RegExp( `^[${Object.values(UnitaryNames).map(RegexEscape).join('')}]`, "iu" )
const unitaryMap: Record<string, number> = {}
for ( const [name, value] of Object.entries(UnitaryValues) ) {
  unitaryMap[name] = value
  if ( name !== name.toUpperCase() ) unitaryMap[name.toUpperCase()] = value
  if ( name !== name.toLowerCase() ) unitaryMap[name.toLowerCase()] = value
}

const hexDigitReg = /[0-9a-fA-F]/g

function parseHexList( str:string, hexConfig:HexModifier, pushNumber:( num:number, encoding:string, finish:boolean ) => void ) : void {
  const { digits, div, encoding } = hexConfig

  let accum = ""
  let count = 0
  str.replace( hexDigitReg, ( v ) => {
    accum += v
    count += 1
    if ( count == digits ) {
      const value = parseInt( accum, 16 ) / div
      pushNumber( value, encoding, true )
      accum = ""
      count = 0
    }
    return ""
  })
}


enum AxisSymbol {
  Start = 'start',
  End = 'end',
  Step = 'step',
  Multiplier = 'multiplier',
}
const { Start, End, Step, Multiplier } = AxisSymbol

function parseExpression( numbers, symbols, encodings, keepEncoding ) {
  if ( numbers.length == 1 && symbols.length < 2 ) {
    // Just a plain old number
    if ( keepEncoding ) {
      return { value: numbers[0], encoding: encodings[0] }
    } else {
      return numbers[0]
    }
  }

  let axis
  let axisIndex
  const axes: gggRangeAxis[] = []
  let lastSymbol

  function resetAxis() {
    axis = {
      start: NaN,
      end: NaN,
      step: NaN,
      count: NaN,
      multiplier: NaN,
      inclusive: false,
    }
    axisIndex = 0
  }

  resetAxis()

  for ( let i = 0; i < numbers.length; i++ ) {
    const number = numbers[i]
    const symbolBefore = symbols[i]

    // if ( !symbolBefore ) {
    //   // No symbol, just a number
    //   if ( axisIndex ) {
    //     axis[ axisIndex ] = number
    //   }
    // } else if ( symbolBefore == GGG.NextAxis ) {
    //   axes.push( axis )
    //   resetAxis()
    // } else if ( symbolBefore == ">" || symbolBefore == "<" ) {
    //   // Inclusive or exclusive
    //   if ( axisIndex == Start ) {
    //     axis.inclusive = symbolBefore == ">"
    //   } else {
    //     axisIndex = Step
    //     axis.step = number
    //   }

    // }

    if ( symbolBefore == GGG.NextAxis ) {
      if ( axis ) {
        axes.push( axis )
        resetAxis()
      }
    }

    switch ( axisIndex++ ) {
      case 0:
        axis.start = number
        break
      case 1:
        axis.end = number
        if ( symbolBefore == ":" ) {
          axis.inclusive = true
        } else if ( symbolBefore == ">" || symbolBefore == "<" ) {
          axis.inclusive = false
        }
        break
      case 2:
        if ( symbolBefore == "/" ) {
          axis.count = number
        } else {
          axis.step = number
        }
        break
      case 3:
        axis.multiplier = number
        break
    }


  }

  // Handle trailing range symbol with no end value (open range, e.g. "R-1:")
  const trailingSymbol = symbols[numbers.length]
  if ( trailingSymbol == GGG.Range ) {
    axis.inclusive = true
  }

  if ( axis ) {
    axes.push( axis )
  }

  if ( axes.length == 1 ) {
    return axes[0]
  } else if ( axes.length > 1 ) {
    return { axes }
  }
}


export default function ParseData( str:string, options:ParseOptions = {} ) : [ any, string ] {
  const { keepEncoding = false } = options
  let numbers:number[] = []
  let encodings:string[] = []
  let symbols:string[] = []

  const data : gggPrimitive[] = []
  const subscriptStack:any[] = []
  let currentList = data


  function pushNumber( value:number, encoding: string, finish:boolean ) {
    numbers.push( value )
    encodings.push( encoding )
    if ( !symbols.length ) {
      symbols.push( "" )
    }

    if ( finish ) {
      finishExpression()
    }
  }

  function finishExpression() {
    if ( numbers.length || symbols.length ) {
      const item = parseExpression( numbers, symbols, encodings, keepEncoding )
      currentList.push( item )
    }

    numbers = []
    encodings = []
    symbols = []
  }

  function pushSymbol( value:string ) {
    symbols.push( value )
  }

  function pushString( value:string, encoding: string ) {
    if ( keepEncoding ) {
      currentList.push( { value, encoding } )
    } else {
      currentList.push( value )
    }
  }

  while( str ) {
    let match:RegExpMatchArray|null = null

    let unicode = (str.match( /^./u ) || [""])[0].codePointAt(0) || 0

    if ( match = str.match( unitaryPattern ) ) {
      const value = unitaryMap[ match[0] ]
      pushNumber( value, GGG.EncodedOne, false )
    } else if ( unicode >= 0x80 ) {
      // Unicode character as number
      let uniChar = String.fromCodePoint( unicode )
      pushNumber( unicode, uniChar, false )
      match = [ uniChar ]
    } else if ( str[0] == GGG.StringToEOL ) {
      // String to end of line
      let endIndex = str.indexOf( GGG.End )
      if ( endIndex == -1 ) {
        endIndex = str.length
      }
      const value = str.substring(1, endIndex)
      pushString( value, GGG.StringToEOL )
      str = str.substring( endIndex )
      break
    } else if ( match = str.match( referenceReg ) ) {
      // Is reference
      const register = match[1] ? match[1] : null
      const subscriptStart = match[2]
      const subscript = subscriptStart ? [] : {}
      const reference = { register, subscript: [] }

      if ( subscriptStart ) {
        currentList.push( reference as gggReference )
        subscriptStack.push( reference )
        currentList = reference.subscript        
      }
    } else if ( match = str.match( hexNumber ) ) {
      // Hex number
      const hexMatch = match[0]
      const hexData = hexMatch.substring(2)
      const hexModCode = gggCasedString(hexMatch[1])
      const hexConfig = HexModifiers[ hexModCode ]

      if ( hexConfig ) {
        parseHexList( hexData, hexConfig, pushNumber )
      } else {
        const value = parseInt( hexData, 16 )
        pushNumber( value, GGG.HexNumber, false )
      }
    } else if ( match = str.match( decimalNumber ) ) {
      const value = parseFloat( match[0] )
      pushNumber( value, "", false )
    } else if ( match = str.match( doubleQuotedString ) ) {
      try {
        const string = JSON.parse( match[0] )
        pushString( string, GGG.Quote )
      } catch ( err ) {
        console.warn("Bad string")
      }
    }

    if ( !match ) {
      // Allow consecutive symbols (e.g. ":/3" — open range with count)
      // by injecting NaN for the missing number before consuming the symbol.
      const tail = str[0]
      if ( numbers.length > 0 && (
        tail == GGG.Range ||
        tail == GGG.Uninclusive ||
        tail == GGG.Multiplier ||
        tail == GGG.Count ||
        tail == GGG.NextAxis
      )) {
        pushNumber( NaN, "", false )
        str = str.substring(1)
        pushSymbol( tail )
        continue
      }
      break
    }

    str = str.substring( match[0].length )

    if ( !str )
      break

    const tail = str[0]

    if ( tail == GGG.EndArgument ) {
      // End of argument
      break
    } else if ( tail == GGG.Comma ) {
      // End of segment
      finishExpression()
      str = str.substring(1)
      continue
    } else if ( tail == GGG.SubscriptEnd ) {
      // End of subscript
      str = str.substring(1)
      finishExpression()
      subscriptStack.pop()
      if ( subscriptStack.length ) {
        currentList = subscriptStack[subscriptStack.length-1].subscript
      } else {
        currentList = data
      }
      continue
    } else if ( 
      tail == GGG.Range ||
      tail == GGG.Uninclusive ||
      tail == GGG.Multiplier ||
      tail == GGG.Count ||
      tail == GGG.NextAxis
    ) {
      // Meaningful seperator
      str = str.substring(1)
      pushSymbol( tail )
      continue
    } else {
      finishExpression()
    }
  } 

  finishExpression()

  return [ data, str ]
}
