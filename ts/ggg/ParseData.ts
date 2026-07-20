import { GGG, CasedString, Primitive, RangeAxis, Reference, ParseOptions, UnitaryNames, UnitaryValues, HexEncodings } from "./Language"
import { HexModifiers, HexModifier } from "./hexlist"


const hexPrefixCodes = HexEncodings.HexList1 + HexEncodings.HexList2 + HexEncodings.HexNorm1 + HexEncodings.HexNorm2 + HexEncodings.HexNumber
const hexNumberPattern = `^0[${hexPrefixCodes}][0-9a-f]+`
const hexNumber = new RegExp( hexNumberPattern, "i" )
// The `\.\d+` alternative accepts a leading decimal point (".5" is 0.5). Without
// it a number had to start with a digit, so ".5" matched nothing at all and was
// dropped -- silently, even mid-list ("V1,.5" yielded just 1).
const decimalNumber = /^[+-]?(\d+(\.\d+)?|\.\d+)([Ee][+-]?\d+)?/
const doubleQuotedString = /^((""|".*?[^\\]"))/

const RegexEscape = ( str:string ) => str.replace( /[-/\\^$*+?.()|[\]{}]/g, "\\$&" )
const referenceReg = new RegExp( `^${RegexEscape(GGG.Reference)}([a-zA-Z0-9_]*)(${RegexEscape(GGG.At)}?)(${RegexEscape(GGG.Subscript)}?)` )

// A leading sign negates the constant: "-π" is -3.14159. Captured separately so
// the sign can be applied to the looked-up value.
const unitaryPattern = new RegExp( `^([+-]?)([${Object.values(UnitaryNames).map(RegexEscape).join("")}])`, "iu" )
// A sign directly before a non-ASCII character negates its code point too.
const signedUnicode = /^([+-])(.)/u
// "0X" with no hex digits after it is not a number; consume it and yield nothing
// rather than falling through to the decimal match and producing a bare 0.
const hexPrefixEmpty = new RegExp( `^0[${hexPrefixCodes}]`, "i" )
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
  Start = "start",
  End = "end",
  Step = "step",
  Multiplier = "multiplier",
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
  const axes: RangeAxis[] = []
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

    // The first number of an axis is the start; every later number is routed by
    // the symbol that PRECEDES it, not by position -- so components may be
    // skipped (e.g. "a*m" sets the multiplier with no range, "a/n" a bare count).
    if ( axisIndex == 0 ) {
      axis.start = number
      axisIndex = 1
    } else {
      switch ( symbolBefore ) {
        case ":":             // fills the next empty slot: end -> step -> multiplier
        case ">":             // ( a:b:s:m ); ":" ends inclusively, ">"/"<" exclusively
        case "<":
          if ( isNaN( axis.end ) ) {
            axis.end = number
            axis.inclusive = symbolBefore == ":"
          } else if ( isNaN( axis.step ) ) {
            axis.step = number
          } else {
            axis.multiplier = number
          }
          break
        case "/":             // count
          axis.count = number
          break
        case "*":             // multiplier
          axis.multiplier = number
          break
      }
    }


  }

  // A trailing range symbol with no end value is an OPEN range ("1:", "1>"): it
  // runs to the dimension it is resolved against. Mark it so Solve can tell it
  // apart from a lone axis value, which otherwise parses identically (both end
  // up with a blank end, and "inclusive" defaults to false).
  const trailingSymbol = symbols[numbers.length]
  if ( trailingSymbol == GGG.Range ) {
    axis.open = true
    axis.inclusive = true
  } else if ( trailingSymbol == GGG.Uninclusive ) {
    axis.open = true
    axis.inclusive = false
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


export default function ParseData( str:string, options:ParseOptions = {} ) : [ Primitive[], string ] {
  const { keepEncoding = false } = options
  let numbers:number[] = []
  let encodings:string[] = []
  let symbols:string[] = []

  const data : Primitive[] = []
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

    const unicode = (str.match( /^./u ) || [""])[0].codePointAt(0) || 0

    if ( ( match = str.match( unitaryPattern ) ) ) {
      const value = unitaryMap[ match[2] ]
      pushNumber( match[1] === "-" ? -value : value, GGG.EncodedOne, false )
    } else if ( unicode >= 0x80 ) {
      // Unicode character as number
      const uniChar = String.fromCodePoint( unicode )
      pushNumber( unicode, uniChar, false )
      match = [ uniChar ]
    } else if ( ( match = str.match( signedUnicode ) ) && ( match[2].codePointAt(0) || 0 ) >= 0x80 ) {
      // Signed code point ("-☃"). Re-read with the full code point so astral
      // characters are not split.
      const signed = str.substring(1)
      const point = ( signed.match( /^./u ) || [""] )[0]
      const cp = point.codePointAt(0) || 0
      pushNumber( match[1] === "-" ? -cp : cp, point, false )
      match = [ match[1] + point ]
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
    } else if ( ( match = str.match( referenceReg ) ) ) {
      // Is reference. Always emit the reference; a bare $name (no subscript)
      // reads the whole register at solve time. With a subscript, descend so
      // the bracketed expression becomes reference.subscript. An `@` before the
      // subscript marks an offset reference: it yields the flat offsets computed
      // from the subscript coordinates against the register, not the values.
      const register = match[1] ? match[1] : null
      const offset = match[2] === GGG.At
      const subscriptStart = match[3]
      const reference = { register, subscript: [], offset }

      currentList.push( reference as Reference )

      if ( subscriptStart ) {
        subscriptStack.push( reference )
        currentList = reference.subscript
      }
    } else if ( ( match = str.match( hexNumber ) ) ) {
      // Hex number
      const hexMatch = match[0]
      const hexData = hexMatch.substring(2)
      const hexModCode = CasedString(hexMatch[1])
      const hexConfig = HexModifiers[ hexModCode ]

      if ( hexConfig ) {
        parseHexList( hexData, hexConfig, pushNumber )
      } else {
        const value = parseInt( hexData, 16 )
        pushNumber( value, HexEncodings.HexNumber, false )
      }
    } else if ( ( match = str.match( hexPrefixEmpty ) ) ) {
      // Matched but pushes no value: an empty hex prefix is not a number.
    } else if ( ( match = str.match( decimalNumber ) ) ) {
      const value = parseFloat( match[0] )
      pushNumber( value, "", false )
    } else if ( ( match = str.match( doubleQuotedString ) ) ) {
      try {
        const string = JSON.parse( match[0] )
        pushString( string, GGG.Quote )
      } catch ( err ) {
        // console.warn("Bad string")
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
