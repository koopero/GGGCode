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
