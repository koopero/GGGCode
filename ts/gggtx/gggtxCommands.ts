
import { isString } from "../common/util"
import { FormatData } from "../ggg/Format"
import { GGG, gggCommandConvention, gggHooks } from "../ggg/gggLang"
const gggtxRegisterPrefix = "R"

const gggtxFlowPrefix = "T"

export enum gggtxCodes {
  RegisterIndex = gggtxRegisterPrefix,
  Value = GGG.Data,

  ListRegisters = `${gggtxRegisterPrefix}${gggCommandConvention.List}`,
  ListRegistersResponse = `${gggtxRegisterPrefix}${gggCommandConvention.ListResponse}`,
  OutputRegisters = `${gggtxRegisterPrefix}${gggCommandConvention.Output}`,
  WriteRegisters = `${gggtxRegisterPrefix}${gggCommandConvention.Write}`,

  BlockEnd = `${gggtxFlowPrefix}1`,
  LoopWhile = `${gggtxFlowPrefix}30`,
  LoopAsync = `${gggtxFlowPrefix}31`,
  LoopIf = `${gggtxFlowPrefix}31`,
  LoopFunction = `${gggtxFlowPrefix}32`,
}

const RegisterIndexArg = {
  type: "*",
  description: "Register index",
}

const ListRegistersDescription = "List registers"

const gggtxRegisterCommands : gggCommands = {
  [gggtxCodes.ListRegisters]: {
    description: ListRegistersDescription,
    [gggHooks.Command]: ( args ) => {
      const { machine, state } = args
      state.hasListed = false
      machine.output( { code: gggtxCodes.ListRegistersResponse, comment: ListRegistersDescription } )
    },
    [gggHooks.Value]: ( arg ) => {
      const { machine, state, value } = arg
      const { registers } = machine

      const register = registers.get( value )
      if ( register ) {
        state.hasListed = true
        machine.output( { value: register } )
      }
    },
    [gggHooks.End]: ( arg ) => {
      const { machine, state } = arg
      if ( !state.hasListed ) {
        const { registers } = machine
        registers.eachPair( ( register, key ) => { 
          const { data } = register
          const description = FormatData( data )
          const comment = `;  ${key}: ${description}`
          machine.output( { comment } )
        })
      }
    }
  },
  [gggtxCodes.WriteRegisters]: {
    description: "Write registers",
    args: {
      [gggtxRegisterPrefix]: RegisterIndexArg,
    },
    [gggHooks.Command]: ( args ) => {
      const { machine, state } = args
      state.register = null
      state.writeIndex = 0
    },
    [gggHooks.Value]: ( args ) => {
      const { machine, state, code, value } = args
      const { registers } = machine
      switch ( code ) {
        case gggtxCodes.RegisterIndex:
          const register = registers.get( value ) || registers.add( { data: [] }, value )
          state.register = register
          state.writeIndex = 0
          break

        case GGG.Register:
          if ( isString( value ) ) {
            if ( state.register ) {
              state.register.name = value
            } else {
              state.register = registers.add( { data: [] }, value )
            }
          }
          break

        case GGG.Data:
          if ( state.register ) {
            state.register.data[state.writeIndex] = value
            state.writeIndex++
          }
          break
      }
    },
  },
  [gggtxCodes.OutputRegisters]: {
    description: "Output registers",
    args: {
      [gggtxRegisterPrefix]: RegisterIndexArg,
    }
  },
}

const BooleanCommandHookCommand = ( args ) => {
  const { machine, state } = args
  state.bool = false
}

const BooleanCommandHookValue = ( args ) => {
  const { state, code, value } = args
  switch ( code ) {
    case GGG.Data:
      if ( value ) {
        state.bool = true
      }
      break
  }
}


const gggtxFlowCommands : gggCommands = {
  [gggtxCodes.BlockEnd]: {
    description: "End of block",
  },
  [gggtxCodes.LoopWhile]: {
    description: "Loop while condition is met",
    [gggHooks.Command]: BooleanCommandHookCommand,
    [gggHooks.Value]: BooleanCommandHookValue,
    [gggHooks.End]: ( args ) => {
      const { machine, state } = args
      const { bool } = state

      const ref = bool ? machine.addQueueReference() : null
      const stackState = {
        ref, bool
      }
      machine.pushStack( stackState )
      machine.setSkip( !bool )
    }, 
    [gggHooks.Stack]: ( args ) => { 
      const { machine, state, command } = args
      if ( command == gggtxCodes.BlockEnd ) {
        machine.popStack()
        const { ref } = state
        if ( ref ) {
          machine.jumpQueue( ref )
        }
        machine.removeQueueReference( ref )
        machine.setSkip( false )
      }
    }
  },
  [gggtxCodes.LoopIf]: {
    description: "Run if condition is met",
    [gggHooks.Command]: BooleanCommandHookCommand,
    [gggHooks.Value]: BooleanCommandHookValue,
    [gggHooks.End]: ( args ) => {
      const { machine, state } = args
      const { bool } = state
      const stackState = {
        bool
      }
      machine.pushStack( stackState )
      machine.setSkip( !bool )
    }, 
    [gggHooks.Stack]: ( args ) => { 
      const { machine, state, command } = args
      if ( command == gggtxCodes.BlockEnd ) {
        machine.popStack()
        machine.setSkip( false )
      }
    }
  },
}

const gggtxCommands = {
  ...gggtxRegisterCommands,
  ...gggtxFlowCommands,
} 

export default gggtxCommands