import { isArray, isNumber, isObject, isString } from "../common/util"
import Format, { FormatData } from "../ggg/Format"
import { GGG, gggCommandConvention, gggNumeric, gggRangeAxes } from "../ggg/gggLang"

export const PrintPrefix = "P"
export const PrintNumbersName = `${PrintPrefix}${gggCommandConvention.Read}`
export const PrintResponseName = `${PrintPrefix}${gggCommandConvention.ReadResponse}`
export const PrintStringName = `${PrintPrefix}${gggCommandConvention.Display}`

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

export function PrintNumbers( value: PrintNumbersArg, stream?:WritableStream ) {

  let _encoding = ""
  let _code = ''
  let _needComma = false

  printValue( value )

  function printString( str:string ) {
    if ( stream ) {
    //   stream.push( str )
    }
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
  return str.split('').map( c => c.charCodeAt(0) )
}