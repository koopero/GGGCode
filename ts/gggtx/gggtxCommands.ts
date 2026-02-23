
import { isString } from "../common/util"
import { FormatData } from "../ggg/Format"
import { GGG, CommandConvention, Hooks } from "../ggg/Language"
const gggtxRegisterPrefix = "R"

const gggtxFlowPrefix = "T"

export enum gggtxCodes {
  RegisterIndex = gggtxRegisterPrefix,
  Value = GGG.Data,

  ListRegisters = `${gggtxRegisterPrefix}${CommandConvention.List}`,
  ListRegistersResponse = `${gggtxRegisterPrefix}${CommandConvention.ListResponse}`,
  OutputRegisters = `${gggtxRegisterPrefix}${CommandConvention.Output}`,
  WriteRegisters = `${gggtxRegisterPrefix}${CommandConvention.Write}`,

  BlockEnd = `${gggtxFlowPrefix}1`,
  ProcedureInit = `${gggtxFlowPrefix}10`,
  ProcedureRun = `${gggtxFlowPrefix}11`,
  Loop = `${gggtxFlowPrefix}30`,
}

const RegisterIndexArg = {
  type: "*",
  description: "Register index",
}

const ListRegistersDescription = "List registers"

const gggtxRegisterCommands : Commands = {
  [gggtxCodes.ListRegisters]: {
    description: ListRegistersDescription,
    [Hooks.Command]: ( args ) => {
      const { machine, state } = args
      state.hasListed = false
      machine.output( { code: gggtxCodes.ListRegistersResponse, comment: ListRegistersDescription } )
    },
    [Hooks.Value]: ( arg ) => {
      const { machine, state, value } = arg
      const { registers } = machine

      const register = registers.get( value )
      if ( register ) {
        state.hasListed = true
        machine.output( { value: register } )
      }
    },
    [Hooks.End]: ( arg ) => {
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
    [Hooks.Command]: ( args ) => {
      const { machine, state } = args
      state.register = null
      state.writeIndex = 0
    },
    [Hooks.Value]: ( args ) => {
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

const LoopArgs = {
  'E': {
    description: "Loop each"
  },
  'W': {
    description: "Loop while"
  },
  'I': {
    description: "Loop if"
  },
}

const gggtxFlowCommands : Commands = {
  [gggtxCodes.BlockEnd]: {
    description: "End of block",
  },
  [gggtxCodes.LoopWhile]: {
    description: "Loop while condition is met",
    [Hooks.Command]: BooleanCommandHookCommand,
    [Hooks.Value]: BooleanCommandHookValue,
    [Hooks.End]: ( args ) => {
      const { machine, state } = args
      const { bool } = state

      const ref = bool ? machine.addQueueReference() : null
      const stackState = {
        ref, bool
      }
      machine.pushStack( stackState )
      machine.setSkip( !bool )
    }, 
    [Hooks.Stack]: ( args ) => { 
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
    [Hooks.Command]: BooleanCommandHookCommand,
    [Hooks.Value]: BooleanCommandHookValue,
    [Hooks.End]: ( args ) => {
      const { machine, state } = args
      const { bool } = state
      const stackState = {
        bool
      }
      machine.pushStack( stackState )
      machine.setSkip( !bool )
    }, 
    [Hooks.Stack]: ( args ) => { 
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