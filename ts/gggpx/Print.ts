import { floor } from "../common/math"
import { isArray, isNumber, isObject, isString } from "../common/util"
import Format, { FormatData } from "../ggg/Format"
import { GGG, CommandConvention, gggNumeric, gggRangeAxes } from "../ggg/gggLang"

export const PrintPrefix = "P"
export const PrintNumbersName = `${PrintPrefix}${CommandConvention.Read}`
export const PrintResponseName = `${PrintPrefix}${CommandConvention.ReadResponse}`
export const PrintStringName = `${PrintPrefix}${CommandConvention.Display}`

export const PrintCPPStrings = {
  PrintPrefix,
  PrintNumbersName,
  PrintResponseName,
  PrintStringName,
}

type PrintNumbersOptions = {
  command?: string,
}

type PrintNumbersArg = { 
  code?: string, 
  encoding?: number | string,
  data?: PrintNumbersArg | PrintNumbersArg[],
} | number | string | PrintNumbersArg[]

export function PrintNumbers( value: PrintNumbersArg ) {
  let result = ""
  let _encoding = ""
  let _code = ''
  let _needComma = false

  printValue( value )

  function printString( str:string ) {
    result += str
  }

  function printCode( code?:string ) {
    code = code || _code
    code = code || GGG.Data

    if ( code != _code ) {
      if ( _needComma ) {
        printString( GGG.EndArgument )
      }
      printString( code )
      _needComma = false
      _code = code
    }
  }

  function printNumber( value:number ) {
    printCode()
    if ( _needComma ) {
      printString( GGG.Comma )
    }   
    printString( FormatData( value, _encoding ) )
  }

  function printStringAsData( str:string ) {
    let chars = [ ...str ]
    for ( const char of chars ) {
      printNumber( char.charCodeAt(0) )
    }
  }

  function printValue( value: PrintNumbersArg ) {
    if ( isArray( value ) ) {
      for ( const val of value ) {
        printValue( val )
      }
    } else if ( isNumber( value ) ) {
      printNumber( value )
    } else if ( isObject( value ) ) {
      const { code, encoding, data } = value
      if ( ( code || !_code ) && code != _code ) {
        printCode( code )
      }
      if ( encoding && isString( encoding ) ) {
        _encoding = encoding
      }
      if ( data ) {
        printValue( data )
      }
    } else if ( isString( value ) ) {
      printValue( unicodeToNumbers( value ) )
    }
  }
}

function unicodeToNumbers( str:string ) {
  return [ ...str ].map( char => char.codePointAt(0) )
}

export function PrintString( value:PrintNumbersArg ) {
  let result = "; "
  printValue( value )
  return result

  function printString( str:string ) {
    result += str
  }

  function printCode( code?:number ) {
    code = floor( code || 0 )
    if ( code > 0 ) {
      const char = String.fromCodePoint( code )
      printString( char )
    }
  }

  function printValue( value: PrintNumbersArg ) {
    if ( isArray( value ) ) {
      for ( const val of value ) {
        printValue( val )
      }
    } else if ( isNumber( value ) ) {
      printCode( value )
    } else if ( isString( value ) ) {
      printString( value )
    } else if ( isObject( value ) ) {
      const { data } = value
      if ( data ) {
        printValue( data )
      }
    }
  }
}