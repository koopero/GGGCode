import { floor } from "../common/math"
import { isDefined, isNumber, isString } from "../common/util"
import { GGG, CasedString, Token, Token, Primitive, UnitaryValues } from "./Language"

const gggDimensions = 4

enum gggParserMode {
  None = "None",
  Command = "Command",
  Argument = "Argument",
  Code = "Code",
  Encoding = "Encoding",
  Zero = "Zero",
  Register = "Register",
  Data = "Data",
  Line = "Line",
  Skip = "Skip",
  Hex = "Hex",
  StringToEnd = "String",
  Number = "Number",
  Quoted = "Quoted",
  Escaped = "Escaped",
  Comment = "Comment",
}


function defaultState() {
  return {
    tick: null,
    index: 0,
    col: 0,
    row: 0,
    lineMode: gggParserMode.Command,
    expressionMode: gggParserMode.Code,
    dataMode: gggParserMode.None,
    skipData: false,
    line: "",
    code: "",
    comment: "",
    argBuffer: "",
    numbers: [],
    symbols: [],
    value: null,
    compoundIndex: 0,
    compoundAxes: [],
    hexAccum: 0,
    hexDigit: 0,
    hexDigitCount: 0,
    hexNormalize: false,
    queue: "",
    onIndex: {},
  }
}


type StateType = {
  tick:any
  index:number
  col:number
  row:number
  lineMode:gggParserMode
  expressionMode:gggParserMode
  dataMode:gggParserMode
  skipData:boolean
  code:string
  line:string
  comment:string
  argBuffer:string
  numbers:number[]
  symbols:string[]
  value:Primitive
  compoundIndex:number
  compoundAxes:any[]
  hexAccum:number
  hexDigit:number
  hexDigitCount:number
  hexNormalize:boolean
  queue:string
  onIndex:{ [key:number]:StateFunction[] }
}

type StateFunction = ( state:StateType ) => Promise<void> | void

type ParserOptions = {
  keepComments?:boolean
  keepEncoding?:boolean
}

type ParserArgs = ParserOptions & {
  state?:StateType
  hookCommand?:StateFunction
  hookCode?:StateFunction
  hookValue?:StateFunction
  hookArg?:StateFunction
  hookEnd?:StateFunction
}

class CompoundAxis {
  start:number
  end:number
  step:number

  constructor() {
    this.reset()
  }

  reset() {
    this.start = 0
    this.end = 0
  }

  ingest( value, _char ) {
    if ( _char == ":" ) {
      this.start = value
    } else {
      this.end = value
    }
  }
}

export default function gggParser( props:ParserArgs = {}) {
  const { keepComments, hookCommand, hookCode, hookValue, hookArg, hookEnd } = props
  const { state = defaultState() } = props


  function activateTick() {
    if ( !state.tick ) {
      state.tick = setTimeout( tick, 0 )
    }
  }

  async function tick() {
    const { queue, onIndex } = state

    if ( queue ) {
      const cp = queue.codePointAt(0) || 0
      const char = String.fromCodePoint(cp)
      state.queue = queue.substring( char.length )
      await parse( char )
      if ( onIndex[ state.index ] ) {
        for ( const func of onIndex[ state.index ] ) {
          func()
        }
        delete onIndex[ state.index ]
      }
      state.index++
      state.col++
    }
  
    state.tick = null
    if ( state.queue )
      activateTick()
  }

  async function waitForIndex( index ) {
    if ( index <= state.index ) return
    const { onIndex } = state

    return new Promise( resolve => {
      onIndex[ index ] = onIndex[ index ] || []
      onIndex[ index ].push( resolve )
    })
  }

  async function flush() {
    if ( !state.queue ) return
  }

  function write( text ) {
    if ( !text ) return
    state.queue += text
    activateTick()
  }

  async function run( text ) {
    if ( !text ) return
    const nextIndex = state.index + state.queue.length + text.length - 1
    state.queue += text

    activateTick()
    await waitForIndex( nextIndex )
  }

  async function parse( _char ) {

    if ( _char == GGG.End ) {
      // End of line
      state.line += _char
      await finishLine()
      return
    }

    const { lineMode, expressionMode, dataMode } = state
    if ( expressionMode == gggParserMode.Data && dataMode == gggParserMode.StringToEnd ) {
      // StringToEnd
      state.argBuffer += _char
      return
    }

    if ( lineMode == gggParserMode.Skip ) {
      // Skip
      return
    }

    if ( _char == GGG.Break ) {
      // Command Break / Comment ";"
      await finishCommand()
      if ( keepComments ) {
        state.line += _char
        state.lineMode = gggParserMode.Comment
        state.comment = _char
      } else {
        state.lineMode = gggParserMode.Skip
      }

      return
    }

    if ( lineMode == gggParserMode.Comment ) {
      // Comment
      state.comment += _char
      return
    }

    if ( lineMode == gggParserMode.Command || lineMode == gggParserMode.Argument ) {
      // Unicode codepoint outside quoted strings
      const codePoint = _char.codePointAt(0) || 0
      if ( codePoint >= 0x80 &&
           state.dataMode !== gggParserMode.Quoted &&
           state.dataMode !== gggParserMode.Escaped ) {
        await finishCompound()
        await dataAppend( codePoint )
        return
      }

      // Actual expression
      switch( state.expressionMode ) {
        case gggParserMode.Code:
          await parseCode( _char )
          break
        case gggParserMode.Encoding:
          await parseEncoding( _char )
          break
        case gggParserMode.Register:
          // parseRegister( _char )
          break
        case gggParserMode.Data:
          await parseData( _char )
          break
  
        default:
          break
      }
    }
  }

  function resetArg() {
    resetCompound()
  } 

  function resetCompound() {
    state.numbers = []
    state.symbols = []
    state.value = null
  }



  async function parseCode( _char:string ) {
    if ( /^[A-Z]$/i.test( _char ) ) {
      _char = CasedString( _char )
      state.code = _char
      resetArg()
      if ( state.lineMode == gggParserMode.Argument ) {
        hookCode && hookCode( state )
      }

      state.expressionMode = gggParserMode.Encoding
      return
    }
  }

  async function parseEncoding( _char:string ) {
    if ( await parseEndOfNumber( _char ) ) {
      // We're done
    } else if ( _char == GGG.Comment ) {
      skipToEndOfLine()
    } else if ( _char == GGG.Zero ) {
      startNumber()
      bufferAppend( _char )
      state.dataMode = gggParserMode.Zero
    } else if ( _char == GGG.Quote ) {
      startQuotedString()
    } else if ( /^[\d\.\+\-]$/.test( _char ) ) {
      startNumber()
      bufferAppend( _char )
    } else if ( _char == GGG.StringToEOL ) {
      startStringToEOL()
    } else {
      _char = CasedString( _char )
      const unitaryValue = (UnitaryValues as Record<string, number>)[ _char ]
      if ( unitaryValue !== undefined ) {
        finishCompound()
        await dataAppend( unitaryValue )
      }
    }
  }

  async function parseData( _char:string ) {

    if ( state.dataMode == gggParserMode.Line ) {
      bufferAppend( _char )
    } else if ( state.dataMode == gggParserMode.Quoted ) {
      if ( _char == GGG.Quote ) {
        await dataAppend( state.argBuffer )
        state.argBuffer = ""
      } else if ( _char == GGG.Escape ) {
        state.dataMode = gggParserMode.Escaped
      } else {
        bufferAppend( _char )
      }
    } else if ( state.dataMode == gggParserMode.Escaped ) {
      if ( _char == GGG.Quote ) {
        bufferAppend( _char )
      } else {
        bufferAppend( GGG.Escape )
        bufferAppend( _char )
      }
      state.dataMode = gggParserMode.Quoted
    } else if ( await parseEndOfNumber( _char ) ) {
      // We're done
    } else if ( state.dataMode == gggParserMode.Zero ) {
      await parseAfterZero( _char )
    } else if ( state.dataMode == gggParserMode.Number ) {
      bufferAppend( _char )
    } else if ( state.dataMode == gggParserMode.Hex ) {
      await parseHex( _char )
    }
  }

  async function parseEndOfNumber( _char:string ) {
    switch( _char ) {
      case " ":
        await finishArg()
        return true

      // case ']':
        // await finishReference()
      case ",":
        await finishCompound()
        return true
      case ":":
      case "/":
      case ">":
      case "<":
      case "*":
      case "|":
        await finishSegment( _char )
        return true
    }
    return false
  }


  async function parseHex( _char:string ) {
    let digit = -1
    switch( _char ) {
      case "0": digit = 0; break
      case "1": digit = 1; break
      case "2": digit = 2; break
      case "3": digit = 3; break
      case "4": digit = 4; break
      case "5": digit = 5; break
      case "6": digit = 6; break
      case "7": digit = 7; break
      case "8": digit = 8; break
      case "9": digit = 9; break
      case "A": digit = 10; break
      case "B": digit = 11; break
      case "C": digit = 12; break
      case "D": digit = 13; break
      case "E": digit = 14; break
      case "F": digit = 15; break
      case "a": digit = 10; break
      case "b": digit = 11; break
      case "c": digit = 12; break
      case "d": digit = 13; break
      case "e": digit = 14; break
      case "f": digit = 15; break
    }
    if ( digit != -1 ) {
      if ( state.hexDigit < 7 ) {
        state.hexAccum = ( state.hexAccum << 4 ) | digit
        state.hexDigit++
      }
      if ( state.hexDigitCount > 0 && state.hexDigit == state.hexDigitCount ) {
        let value = state.hexAccum
        if ( state.hexNormalize ) {
          value /= (1 << ( state.hexDigit * 4 )) - 1 
        }
        await dataAppend( value )
        state.hexDigit = 0
        state.hexAccum = 0
      }
    }
  }

  function bufferAppend( _char:string ) {
    state.argBuffer = state.argBuffer || ""
    state.argBuffer += _char
  }

  async function dataAppend( value:Primitive ) {
    if ( state.skipData ) {
      return
    }

    state.value = value

    if ( state.lineMode == gggParserMode.Command ) {
      state.expressionMode = gggParserMode.Data
      state.lineMode = gggParserMode.Argument
      state.skipData = true
      hookCommand && hookCommand( state )
    } else {
      if ( isNumber( value ) ) {
        state.numbers.push( value as number )
      } else if ( isString( value ) ) {
        hookValue && await hookValue( state )
      }
      // hookValue && hookValue( state )
    }
  }

  async function finishNumber() {
    if ( state.dataMode == gggParserMode.Zero ) {
      dataAppend( 0 )
    } else if ( state.dataMode == gggParserMode.Hex && state.hexDigit > 0 && state.hexDigitCount == 0 ) {
      let value = state.hexAccum
      if ( state.hexNormalize ) {
        value /= (1 << ( state.hexDigit * 4 )) - 1
      }
      dataAppend( value )
      state.hexDigit = 0
      state.hexAccum = 0
      state.hexDigitCount = 0
    } else if ( state.argBuffer && state.dataMode == gggParserMode.Number ) {
      const value = parseFloat( state.argBuffer )
      if ( !isNaN( value )) {
        dataAppend( value )
      }
    }

    state.expressionMode = gggParserMode.Encoding
    state.argBuffer = ""
  }

  async function finishSegment( _char:string) {
    await finishNumber()
    state.symbols.push( _char )
    // if ( state.compoundIndex < gggDimensions ) {
    //   state.compoundAxes[state.compoundIndex].ingest( state.number, _char )
    //   state.compoundIndex++
    // }
  }


  async function finishAxis( _char:string ) {

  }

  async function finishCompound() {
    await finishNumber()
    const { numbers, symbols } = state
    let value:Primitive
    
    if ( numbers.length == 1 && symbols.length == 0 ) {
      value = numbers[0]
    } else {
      let axis
      let axisIndex
      const axes = []
      let lastSymbol

  
      for ( let i = 0; i < numbers.length; i++ ) {
        if ( !axis ) {
          axis = {
            start: NaN,
            end: NaN,
            step: NaN,
            count: NaN,
            multiplier: NaN,
            inclusive: true,
          }
          axisIndex = 0
        }

        const symbolBefore = symbols[i-1]

        switch ( axisIndex++ ) {
          case 0:
            axis.start = numbers[i]
            break
          case 1:
            axis.end = numbers[i]
            if ( symbolBefore == ":" ) {
              axis.inclusive = true
            } else if ( symbolBefore == ">" || symbolBefore == "<" ) {
              axis.inclusive = false
            }
            break
          case 2:
            if ( symbolBefore == "/" ) {
              axis.count = numbers[i]
            } else {
              axis.step = numbers[i]
            }
            break
          case 3:
            axis.multiplier = numbers[i]
            break
        }

        const symbolAfter = symbols[i]
        if ( symbolAfter == "|" ) {
          axes.push( axis )
          axis = null
        }
      }

      if ( axis ) {
        axes.push( axis )
      }

      if ( axes.length == 1 ) {
        value = axes[0]
      } else if ( axes.length > 1 ) {
        value = { 
          axes
        }
      }
    }

    if ( isDefined( value ) ) {
      state.value = value
      hookValue && await hookValue( state )
    }

    resetCompound()
  }

  async function finishData() {
    await finishCompound()
  }

  async function finishArg() {
    const { lineMode, expressionMode } = state
    if ( expressionMode == gggParserMode.Data || expressionMode == gggParserMode.Encoding ) {
      await finishData()
      if ( lineMode == gggParserMode.Argument && !state.skipData ) {
        hookArg && await hookArg( state )
      }
    }
    state.expressionMode = gggParserMode.Code
    state.lineMode = gggParserMode.Argument
    state.dataMode = gggParserMode.None
    state.skipData = false
  }

  async function finishCommand() {
    if ( state.lineMode == gggParserMode.Argument ) {
      await finishArg()
      if ( !keepComments ) {
        hookEnd && await hookEnd( state )
      }

      state.lineMode = gggParserMode.Skip
    }
  }

  async function finishLine() {
    await finishCommand()
    if ( keepComments ) {
      hookEnd && await hookEnd( state )
    }
    resetLine()
  }

  async function parseAfterZero( _char:string ) {
    _char = CasedString( _char )
    switch( _char ) {
      case GGG.HexNumber: startHex( 0, false ); break
      case GGG.HexList1: startHex( 1, false ); break
      case GGG.HexList2: startHex( 2, false ); break
      case GGG.HexNorm1: startHex( 1, true );  break
      case GGG.HexNorm2: startHex( 2, true );  break

      default:
        state.expressionMode = gggParserMode.Data
        state.dataMode = gggParserMode.Number
        bufferAppend( _char )
        break
    }
  }



  function skipToEndOfLine() {
    state.lineMode = gggParserMode.Comment
  }

  function startNumber() {
    state.argBuffer = ""
    state.expressionMode = gggParserMode.Data
    state.dataMode = gggParserMode.Number
  }

  function startHex( _digitCount, _normalize ) {
    state.argBuffer = ""
    state.expressionMode = gggParserMode.Data
    state.dataMode = gggParserMode.Hex
    state.hexDigitCount = _digitCount
    state.hexNormalize = _normalize
    state.hexAccum = 0
    state.hexDigit = 0
  }

  function startQuotedString() {
    state.expressionMode = gggParserMode.Data
    state.dataMode = gggParserMode.Quoted
  }

  function startStringToEOL() {
    state.argBuffer = ""
    state.expressionMode = gggParserMode.Data
    state.dataMode = gggParserMode.StringToEnd
  }

  function resetLine() {
    state.col = 0
    state.row++
    state.code = ""
    state.lineMode = gggParserMode.Command
    state.expressionMode = gggParserMode.Code
    state.argBuffer = ""
  }

  return {
    state,
    write,
    run,
  }
}


function normalizeCommandName( code:string, value:number ) {
  if ( !isNaN( value ) ) {
    code = CasedString( code )
    code += floor( value ).toString()
  } else {
    code = ""
  }
  return code
}

export function TokenParser( props ) {
  const { hookLine, keepComments } = props

  let line:Token
  let arg:Token 
  resetLine()
  resetArg()

  function resetLine() {
    line = {
      args: []
    }
  }

  function resetArg() {
    arg = {
      code: "",
      data: [],
    }
  }

  const hookCommand = ( state ) => {
    const command = normalizeCommandName( state.code, state.value )
    line.command = command
  }

  const hookCode = ( state ) => {
    arg.code = state.code
  }

  const hookValue = ( state ) => {
    arg.data = arg.data || []
    arg.data.push( state.value )
  }

  const hookArg = ( state ) => {
    line.args.push( arg )
    resetArg()
  }

  const hookEnd = async ( state ) => {
    if ( keepComments ) {
      line.comment = state.comment
    }
    await hookLine( line )
  }

  const { state, write, run } = gggParser( { keepComments, hookCommand, hookCode, hookValue, hookArg, hookEnd } )
  return { state, write, run }
}

export async function parseLines( text:string, options:ParserOptions = {} ) {
  const { keepComments = false, keepEncoding = false } = options || {}
  const lines = []
  function hookLine( line ) {
    lines.push( line )
  }
  const { run } = TokenParser( { hookLine, keepComments } )
  await run( text )
  return lines
}