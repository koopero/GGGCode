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