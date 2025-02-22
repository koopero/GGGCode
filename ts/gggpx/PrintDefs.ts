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

type PrintArg = { 
  code?: string, 
  encoding?: number | string,
  data?: PrintArg | PrintArg[],
} | number | string | PrintArg[]


export function PrintString( value:PrintArg ) {
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

  function printValue( value: PrintArg ) {
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