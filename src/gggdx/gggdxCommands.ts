import { gggCommandConvention, gggHooks } from "../ggg/gggLang"
const description = "List available commands."
const prefix = "D"

export enum gggdxCodes {
  CommandsList = `${prefix}${gggCommandConvention.List}`,
  ListCommandsResponse = `${prefix}${gggCommandConvention.ListResponse}`,
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
}

const gggdxCommands = {
  [ gggdxCodes.CommandsList ]: {
    description,
    [gggHooks.End]: hookD1End,
  }
}

export default gggdxCommands