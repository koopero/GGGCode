import gggNamedList, { gggNamedListItem } from "../ggg/gggNamedList"

enum DocType {
  Any = "any",
  Number = "number",
  String = "string",
  Boolean = "boolean",
}

type DocArgument = {
  name: string,
  type: DocType,
  description: string,
  quantity: string,
  keys: string[],
  options: gggNamedList<gggNamedListItem>
}

type DocCommand = {
  command: string,
  description: string,
  args: DocArgument[],
}

import { CommandConvention, gggHooks } from "../ggg/gggLang"
const description = "List available commands."
const prefix = "D"

export enum gggdxCodes {
  CommandsList = `${prefix}${CommandConvention.List}`,
  ListCommandsResponse = `${prefix}${CommandConvention.ListResponse}`,
}

function hookD1End( arg ) {
  const { machine } = arg

  machine.output( { code:gggdxCodes.ListCommandsResponse, comment: description } )

  const { commands } = machine

  for ( const command in commands ) {
    const impl = commands[command]
    const { description = "", args } = impl
    machine.output( { comment: `${command} : ${description}` } )
    
    if ( args )
      for ( const key in args ) {
        const arg = args[key]
        const { 
          description = "",
          format = "",
          options
        } = arg

        machine.output( { comment: `  ${key}${format} ; ${description}` } )

        if ( options ) {
          options.eachPair( ( option, key ) => {
            const { description = "" } = option
            machine.output( { comment: `    ${key} ; ${description}` } )
          })
        }
      }
  }

  machine.outputOk()
  // HookEndDefault( arg )
}

const DocCommands = {
  [ gggdxCodes.CommandsList ]: {
    // command: gggdxCodes.CommandsList,
    description,
    [gggHooks.End]: hookD1End,
  }
}

export default DocCommands