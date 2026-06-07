import NamedList, { NamedListItem } from "../ggg/NamedList"

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
  options: NamedList<NamedListItem>
}

type DocCommand = {
  command: string,
  description: string,
  args: DocArgument[],
}

import { CommandConvention, Hooks } from "../ggg/Language"
const description = "List available commands."
const prefix = "D"

export enum gggdxCodes {
  CommandsList = `${prefix}${CommandConvention.List}`,
  ListCommandsResponse = `${prefix}${CommandConvention.ListResponse}`,
}

function hookD1End( arg ) {
  const { machine } = arg

  machine.output( { code:gggdxCodes.ListCommandsResponse, comment: description, eol: true } )

  const { commands } = machine

  for ( const command in commands ) {
    const impl = commands[command]
    const { description = "", args } = impl
    machine.output( { comment: `${command} : ${description}`, eol: true } )
    
    if ( args )
      for ( const key in args ) {
        const arg = args[key]
        const { 
          description = "",
          format = "",
          options
        } = arg

        machine.output( { comment: `  ${key}${format} ; ${description}`, eol: true } )

        if ( options ) {
          options.eachPair( ( option, key ) => {
            const { description = "" } = option
            machine.output( { comment: `    ${key} ; ${description}`, eol: true } )
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
    [Hooks.End]: hookD1End,
  }
}

export default DocCommands