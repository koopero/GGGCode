import Machine, { MachineProps } from "./ggg/Machine"
import BuiltinCommands from "./builtin"

export type KitchenSinkMachineProps = MachineProps

// A ready-to-run host machine with every TypeScript subsystem installed:
// print/processing, graphics/matrices, flow control, and self-description.
// Callers may still add or override commands through the normal Machine props.
export default class KitchenSinkMachine extends Machine {
  constructor( props:KitchenSinkMachineProps = {} ) {
    const { commands = {}, ...machineProps } = props
    super( {
      ...machineProps,
      commands: {
        ...BuiltinCommands,
        ...commands,
      },
    } )
  }
}
