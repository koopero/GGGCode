import DocCommands from "./gggdx/DocCommands"
import { GXCommands } from "./ggggx/GXCommands"
import PrintCommands from "./gggpx/PrintCommands"
import gggtxCommands from "./gggtx/gggtxCommands"

export const BuiltinCommands = {
  ...DocCommands,
  ...GXCommands,
  ...gggtxCommands,
  ...PrintCommands,
}

export default BuiltinCommands
