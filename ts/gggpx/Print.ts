import Format from "../ggg/Format"
import { gggCommandConvention } from "../ggg/gggLang"

export const PrintPrefix = "P"
export const PrintCommandName = `${PrintPrefix}${gggCommandConvention.Read}`
export const PrintResponseName = `${PrintPrefix}${gggCommandConvention.ReadResponse}`
export const PrintCommentCommandName = `${PrintPrefix}${gggCommandConvention.Display}`

export const PrintCPPStrings = {
  PrintPrefix,
  PrintCommandName,
  PrintResponseName,
  PrintCommentCommandName,
}

export default function Print( value: any, stream: any ) {
  value = Format( value )

}

