import { isNumber, isString } from "../common/util"
import { EncodingCode } from "../ggg/Encoding"
import { FormatNumber, FormatNumberFirst, FormatNumberSubsequent } from "../ggg/Format"
import { gggHookArgs, gggHooks } from "../ggg/gggLang"
import { GGG } from "../ggg/gggLang"
import { PrintPrefix } from "./PrintDefs"

const EncodingEscape = -1

function PrintNumbersHookCommand( arg: gggHookArgs ): void {
  const { state } = arg
  state.needSeperator = false
}

function PrintNumbersHookCode( arg: gggHookArgs ): void {
  const { state } = arg
  state.firstValue = true
  state.writeEncoding = false
  state.wroteCode = false
}

function *valueToNumber( value: number|string|undefined ) : Generator<number> {
  if ( typeof value === "number" ) {
    yield value
  } else if ( typeof value === "string" ) {
    for ( const char of value ) {
      const point = char.codePointAt( 0 )
      if ( isNumber( point ) ) {
        yield point
      }
    }
  }
}

function PrintNumbersHookValue( arg: gggHookArgs ): void {
  const { state, code, value, machine } = arg

  switch ( arg.code ) {
    case GGG.Encoding:
      const { writeEncoding, firstValue } = state
      
      if ( firstValue ) {
        if ( value == EncodingEscape ) {
          state.firstArg = false
          state.writeEncoding = true
          return
        } 
      } 
      if ( !writeEncoding ) {
        state.encoding = EncodingCode( value )
        return
      }
  }

  const { wroteCode, needSeperator, firstValue, encoding } = state
  if ( !wroteCode ) {
    if ( needSeperator ) {
      machine.output( GGG.EndArgument )
    }
    machine.output( code )
    state.wroteCode = true
    state.firstArg = false
    state.needSeperator = true
  }

  for ( const number of valueToNumber( value ) ) {
    if ( state.firstValue ) {
      machine.output( FormatNumberFirst( number, encoding ) )
    } else {
      machine.output( FormatNumberSubsequent( number, encoding ) )
    }
    state.firstValue = false
  }
}

function PrintNumbersHookEnd( arg: gggHookArgs ): void {
  const { state, machine } = arg
  machine.output( GGG.End )
  machine.outputOk()
}

function PrintStringHookCommand( arg: gggHookArgs ): void {
  const { state, machine } = arg
  machine.output( GGG.Comment )
}

function PrintStringHookValue( arg: gggHookArgs ): void {
  const { value, machine } = arg
  if ( isNumber( value ) ) {
    machine.output( String.fromCodePoint( value ) )
  } else if ( isString( value ) ) {
    machine.output( value )
  }
}

function PrintStringHookEnd( arg: gggHookArgs ): void {
  const { machine } = arg
  machine.output( GGG.End )
  machine.outputOk()
}

type PrintMakeCommandsArgs = {
  prefix: string
  printNumbers: number
  printString: number
}

const PrintMakeCommandsDefaults = {
  prefix: PrintPrefix,
  printNumbers: 10,
  printString: 20,
}

export function PrintMakeCommands( args: PrintMakeCommandsArgs = PrintMakeCommandsDefaults ) {
  const result = {}
  const { prefix, printNumbers, printString } = args
  if ( printNumbers ) {
    const command = `${prefix}${printNumbers}`
    result[command] = {
      command,
      description: "Print args as numbers.",
      [gggHooks.Command]: PrintNumbersHookCommand,
      [gggHooks.Code]: PrintNumbersHookCode,
      [gggHooks.Value]: PrintNumbersHookValue,
      [gggHooks.End]: PrintNumbersHookEnd,
    }
  }

  if ( printString ) {
    const command = `${prefix}${printString}`
    result[command] = {
      command,
      description: "Print data as comment string.",
      [gggHooks.Command]: PrintStringHookCommand,
      [gggHooks.Value]: PrintStringHookValue,
      [gggHooks.End]: PrintStringHookEnd
    }
  }
  return result
}

const PrintCommands = PrintMakeCommands()
export default PrintCommands

