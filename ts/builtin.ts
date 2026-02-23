import DocCommands from "./gggdx/DocCommands"
import { GXCommands } from "./ggggx/GXCommands"
import PrintCommands from "./gggpx/PrintCommands"

const BuiltinCommands = {
  ...DocCommands,
  ...GXCommands,
  ...PrintCommands,
}

export default BuiltinCommands