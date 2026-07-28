import {
  GrammarExampleKind,
  GrammarRuleKind,
} from "./Protocol"

export type GrammarRule = {
  name:string,
  kind:GrammarRuleKind,
  value:string,
  description:string,
}

export type GrammarExample = {
  kind:GrammarExampleKind,
  source:string,
  description:string,
}

// Stable lexical and structural facts required to interpret D4/D5 without
// borrowing punctuation conventions from another language.
export const GrammarRules:GrammarRule[] = [
  {
    name: "line.command",
    kind: GrammarRuleKind.Form,
    value: "command arguments",
    description: "A source line contains one command followed by its arguments.",
  },
  {
    name: "line.end",
    kind: GrammarRuleKind.Delimiter,
    value: "\\n",
    description: "A newline terminates the current command.",
  },
  {
    name: "argument.form",
    kind: GrammarRuleKind.Form,
    value: "glyph+data",
    description: "An argument is one glyph immediately followed by its data, for example R0 or L\"name\".",
  },
  {
    name: "argument.separator",
    kind: GrammarRuleKind.Delimiter,
    value: " ",
    description: "Whitespace separates arguments.",
  },
  {
    name: "list.separator",
    kind: GrammarRuleKind.Delimiter,
    value: ",",
    description: "A comma separates values in one argument.",
  },
  {
    name: "list.grouping",
    kind: GrammarRuleKind.Constraint,
    value: "no-parentheses",
    description: "Lists have no wrapper punctuation: write P0,0, never P(0,0).",
  },
  {
    name: "comment.line",
    kind: GrammarRuleKind.Delimiter,
    value: ";",
    description: "Outside a quoted string, a semicolon starts a comment through newline; the comment is discarded.",
  },
  {
    name: "comment.alternatives",
    kind: GrammarRuleKind.Constraint,
    value: "#,//",
    description: "Hash and double slash are not comment delimiters.",
  },
  {
    name: "string.quote",
    kind: GrammarRuleKind.Delimiter,
    value: "\"",
    description: "Double quotes delimit a string and preserve spaces, commas, and semicolons.",
  },
  {
    name: "string.quote-escape",
    kind: GrammarRuleKind.Form,
    value: "\\\"",
    description: "Backslash followed by a double quote embeds a quote in a quoted string.",
  },
  {
    name: "string.to-eol",
    kind: GrammarRuleKind.Delimiter,
    value: "`",
    description: "Backtick begins an unquoted string that continues through newline.",
  },
  {
    name: "number.decimal",
    kind: GrammarRuleKind.Form,
    value: "sign?digits(.digits)?(e sign?digits)?",
    description: "Numbers are decimal with optional sign, fraction, and base-10 exponent.",
  },
  {
    name: "range.inclusive",
    kind: GrammarRuleKind.Delimiter,
    value: ":",
    description: "Between bounds, colon forms an inclusive range.",
  },
  {
    name: "range.exclusive",
    kind: GrammarRuleKind.Delimiter,
    value: ">",
    description: "Between bounds, greater-than forms an end-exclusive range.",
  },
  {
    name: "range.count",
    kind: GrammarRuleKind.Delimiter,
    value: "/",
    description: "A slash followed by a number selects the range sample count.",
  },
  {
    name: "range.multiplier",
    kind: GrammarRuleKind.Delimiter,
    value: "*",
    description: "An asterisk followed by a number multiplies the resolved value.",
  },
  {
    name: "axis.separator",
    kind: GrammarRuleKind.Delimiter,
    value: "|",
    description: "A vertical bar separates axes inside one value expression.",
  },
  {
    name: "reference.form",
    kind: GrammarRuleKind.Form,
    value: "$name",
    description: "Dollar followed by a register name reads that reference.",
  },
  {
    name: "reference.subscript",
    kind: GrammarRuleKind.Form,
    value: "$name[expression]",
    description: "Square brackets select values from a reference; brackets are not list wrappers.",
  },
  {
    name: "reference.offset",
    kind: GrammarRuleKind.Form,
    value: "$name@[coordinates]",
    description: "At before a subscript resolves coordinates to flat offsets instead of values.",
  },
  {
    name: "response.ok",
    kind: GrammarRuleKind.Control,
    value: "OK|O<id>",
    description: "OK is the default successful terminator; O followed by an id is its correlated form.",
  },
  {
    name: "response.failure",
    kind: GrammarRuleKind.Control,
    value: "O<id> F<code>",
    description: "A terminator carrying F is a failure; F selects the published failure domain.",
  },
  {
    name: "result.record",
    kind: GrammarRuleKind.Control,
    value: "D<negative>",
    description: "Negative D records are emitted output and are never executable requests.",
  },
  {
    name: "case.glyph",
    kind: GrammarRuleKind.Constraint,
    value: "case-insensitive",
    description: "Command and argument glyph letters are normalized to uppercase.",
  },
  {
    name: "case.name",
    kind: GrammarRuleKind.Constraint,
    value: "case-sensitive",
    description: "Quoted names and string values preserve case.",
  },
]

export const GrammarExamples:GrammarExample[] = [
  {
    kind: GrammarExampleKind.Valid,
    source: "; comment-only line",
    description: "A semicolon may begin a comment-only line.",
  },
  {
    kind: GrammarExampleKind.Valid,
    source: "G20 R0 P0,0 Q1 V1,0.5 ; trailing comment",
    description: "Lists use commas without wrappers; a trailing semicolon begins a comment.",
  },
  {
    kind: GrammarExampleKind.Valid,
    source: "P13 A\"semicolon ; inside string\"",
    description: "A semicolon inside a quoted string is data, not a comment.",
  },
  {
    kind: GrammarExampleKind.Valid,
    source: "P10 V$r[0:2]",
    description: "Square brackets belong to reference subscripts.",
  },
  {
    kind: GrammarExampleKind.Valid,
    source: "T12 R0 S1000",
    description: "Arguments use glyph+data with whitespace between arguments.",
  },
  {
    kind: GrammarExampleKind.Invalid,
    source: "# comment",
    description: "Hash does not begin a comment.",
  },
  {
    kind: GrammarExampleKind.Invalid,
    source: "// comment",
    description: "Double slash does not begin a comment.",
  },
  {
    kind: GrammarExampleKind.Invalid,
    source: "G20 R0 P(0,0) V1",
    description: "Parentheses are not list syntax; write P0,0.",
  },
  {
    kind: GrammarExampleKind.Invalid,
    source: "G20 R0 V[1,2]",
    description: "Square brackets are reserved for reference subscripts.",
  },
  {
    kind: GrammarExampleKind.Invalid,
    source: "G30 R0 S4 G20 R0 V1",
    description: "A line contains only one command.",
  },
  {
    kind: GrammarExampleKind.Invalid,
    source: "D-40 B\"T10\" T\"command\" S2",
    description: "D-40 is a non-executable result record, not a request.",
  },
]
