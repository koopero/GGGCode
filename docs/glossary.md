# GGGCode Glossary and TypeScript API

Definitions for the wire language and the public TypeScript package.

See also: [tour](tour.md) · [cases](cases.md) · [commands](commands.md) ·
[runtime](runtime.md) · [protocol](protocol.md) · [C++](cxx.md).

## Language concepts

### Command

A command is a letter followed by a signed integer, such as `P10`, `G40`, or
the emitted result record `D-41`. Command and argument glyphs are
case-insensitive and normalized to uppercase. A source line contains one
executable command followed by its arguments.

### Argument

An argument is one glyph immediately followed by its data. Whitespace
separates arguments; lists inside one argument use commas without wrapper
punctuation.

```text
G20 R0 P0,0 Q1 V1,0.5
    ^^ ^^^^ ^^ ^^^^^^
```

Here `R`, `P`, `Q`, and `V` identify four arguments. `P(0,0)` is not GGG list
syntax.

### Comment

Outside a quoted string, `;` starts a comment through the newline. `#` and
`//` are not comment delimiters.

```text
P10 V1,2,3 ; this is a comment
P13 A"semicolon ; inside a string"
```

### List

Commas concatenate values within one argument:

```text
V1,2,3
```

Inside a reference subscript, a comma selects multiple flat indices:
`$buffer[1,2]` reads index 1 and then index 2. Use `|` for coordinates across
matrix axes.

### Range

A range lazily expands into values:

| syntax | meaning |
| --- | --- |
| `1:5` | Inclusive: `1,2,3,4,5`. |
| `1>5` | End-exclusive: `1,2,3,4`. |
| `0:10/5` | Five points: `0,2.5,5,7.5,10`. |
| `0:10:2` | Step by two: `0,2,4,6,8,10`. |
| `5*3` | Multiply the resolved value: `15`. |
| `1:` | Open end; extends to the active matrix dimension when one exists. |

An open range outside a matrix context has no extent and remains one point.

### Multi-axis value

`|` separates coordinate axes. Lone axes combine coordinate-wise, while ranges
produce a Cartesian sweep:

```text
V1|2|3
V0:2|0:3
$image[0|10|20]
```

The first matrix axis is component/stride-1, so image dimensions and positions
are conventionally ordered `C,X,Y,Z`.

### Reference

`$name` reads values from a named matrix register:

| form | meaning |
| --- | --- |
| `$image` | Entire register. |
| `$image[1]` | Flat index 1. |
| `$image[1,2]` | Flat indices 1 and 2. |
| `$image[0\|10\|20]` | Component/x/y coordinate. |
| `$image[0:3]` | Flat inclusive range. |
| `$image@[0\|10\|20]` | Resolve the coordinate to a flat offset instead of reading its value. |

### Register addressing

`R` selects a register, either by numeric index or quoted name:

```text
G10 R0
G10 R"image"
T11 R0
T11 R"blink"
```

`L` never selects. It assigns a name where a command creates or edits a
register:

```text
G30 R0 L"image" S4,64,64
T10 L"blink"
```

Matrix and procedure registers are separate `NamedList` instances but share
the same index/name addressing rule.

### Number and encoded-list formats

| prefix | grouping | result |
| --- | --- | --- |
| decimal | — | `-12.5`, `.5`, `1.2e-3` |
| `0X` | whole token | Hex integer: `0X100` → `256`. |
| `0I` | one hex digit | Raw list: `0I5A` → `5,10`. |
| `0G` | two hex digits | Raw list: `0G5A3B` → `90,59`. |
| `0J` | one hex digit | Normalized list: `0J8` → `8/15`. |
| `0H` | two hex digits | Normalized list: `0H80` → `128/255`. |

### Unitary constant and Unicode literal

Named single-token constants are:

| token | value |
| --- | --- |
| `K` | 1 |
| `Z` | 0 |
| `N` | -1 |
| `π` | pi |
| `τ` | two pi |
| `φ` | golden ratio |
| `γ` | Euler–Mascheroni constant |
| `∞` | infinity |

ASCII constants are case-insensitive. A leading sign negates a constant.
The letter `e` is reserved for decimal exponents and is not Euler's number.

Every other non-ASCII character is its Unicode code point, so `V☃` is `9731`
and `V😀` is `128512`.

### String

A double-quoted string preserves spaces, commas, and semicolons. `\"` embeds a
quote. A backtick begins an unquoted string extending through newline.

### Control response

Every ordinary command ends with an O-prefixed terminator. The default request
id is 1, formatted as `OK`; a command argument `O7` asks the runtime to echo
`O7`. A terminator carrying `F<code>` is failure:

```text
OK
O7
O7 F5 ; buffer not found
```

See [commands.md](commands.md#responses--failures) for published failure values.

### Result record

A negative D code such as `D-40` is emitted data, not an executable command.
The [self-description protocol](protocol.md) describes every result record
through the same command metadata model used for executable requests.

## Wire enums

### `GGG`

`GGG` provides the core parser and conventional argument glyphs:

| name | glyph | role |
| --- | --- | --- |
| `Data` | `A` | General data/string argument. |
| `Command` | `B` | Command-code field in protocol records. |
| `Code` | `C` | Argument-code marker. |
| `Argument` | `U` | Argument-glyph field in protocol records. |
| `End` | newline | Line terminator. |
| `Skip` | `?` | Internal skip state. |
| `EndArgument` | space | Argument separator. |
| `Comment` | `;` | Comment delimiter. |
| `Failure` | `F` | Failure code or filter argument, depending on context. |
| `Value` | `V` | Value argument/field. |
| `Size` | `S` | Size argument. |
| `Offset` | `P` | Position/offset argument. |
| `Repeat` | `G` | Repeat/count argument. |
| `Zero` | `0` | Zero marker. |
| `Number` | `+` | Internal decimal-number mode. |
| `EncodedOne` | `K` | Unitary-one marker. |
| `Operator` | `Q` | Combine operator. |
| `Alias` | `L` | Name assignment. |
| `StringToEOL` | backtick | String through newline. |
| `Dimension` | `D` | Dimension argument. |
| `Encoding` | `E` | Encoding or edge argument. |
| `Storage` | `T` | Storage or mode argument. |
| `Quote` | `"` | String delimiter. |
| `Comma` | `,` | List separator. |
| `Period` | `.` | Decimal point. |
| `Register` | `R` | Register selector/domain reference. |
| `Reference` | `$` | Value-reference prefix. |
| `Range` | `:` | Inclusive range/end/step delimiter. |
| `Uninclusive` | `>` | End-exclusive range delimiter. |
| `Multiplier` | `*` | Range multiplier. |
| `Count` | `/` | Range point count. |
| `Okay` | `O` | Response/request-id glyph. |
| `Escape` | `\` | String escape. |
| `Subscript` | `[` | Reference subscript open. |
| `SubscriptEnd` | `]` | Reference subscript close. |
| `NextAxis` | `\|` | Axis separator. |
| `At` | `@` | Offset-reference modifier. |
| `Target` | `W` | Destination register. |
| `Transform` | `M` | Transform coefficients. |

Hex prefixes live in the separate `HexEncodings` enum: `X`, `I`, `G`, `J`,
and `H`.

### Argument and domain kinds

The self-description repository distinguishes:

- `ArgumentKind`: `data`, `number`, `string`, `boolean`, `enum`, `reference`.
- `EnumDomainKind.Enum`: fixed value/name vocabulary.
- `EnumDomainKind.Reference`: live index/name table.
- `MessageKind.Command`: executable request.
- `MessageKind.Result`: emitted non-executable record.

## TypeScript package

GGGCode is CommonJS-compatible and provides conditional browser exports.

### Package entry points

| import | public surface |
| --- | --- |
| `gggcode` | Parsers, formatter, `Machine`, `Runner`, `NamedList`, protocol/enum domains, and storage helpers. |
| `gggcode/ggg` | Core `Machine`, `NamedList`, and enum repository. |
| `gggcode/ggggx` | `Matrix`, `Sample`, `GXContext`, `SavePNG`, blit/filter/edge domains. |
| `gggcode/math` | Common scalar/vector math helpers. |
| `gggcode/SavePNG` | PNG encoder. |
| `gggcode/LoadPNG` | Node PNG decoder. |

The generated `.d.ts` files shipped with the package are the type-level source
of truth.

### Parsing and formatting

```typescript
import { ParseArg, ParseLine, ParseLines, Format } from "gggcode"

const [line, rest] = ParseLine('P10 V1:3')
const lines = ParseLines('P10 V1\nP10 V2')
const source = Format(line)
```

- `ParseArg(text, options?, col?)` returns `[Token | null, remainingText]`.
- `ParseLine(text, options?)` returns `[Token, remainingText]`.
- `ParseLines(input, options?)` returns `Token[]`.
- `Format(input)` serializes source strings or tokens back to GGG.

Relevant token fields are:

```typescript
type Token = {
  code?: string
  command?: string
  args?: Token[]
  data?: Primitive | Primitive[]
  encoding?: string
  comment?: string
  source?: string
  eol?: boolean
  index?: number
  row?: number
  col?: number
  len?: number
}
```

`source` preserves a parsed line for procedure capture. `eol` marks an emitted
token as a complete output line.

References parsed into `Primitive` have this shape:

```typescript
type Reference = {
  register: string
  subscript: Numeric[]
  offset?: boolean
}
```

### `Machine`

```typescript
import { Machine, Hooks } from "gggcode"

const machine = new Machine({
  commands: {
    P0: {
      [Hooks.End]: ({ machine }) => machine.outputOk(),
    },
  },
})
const output = await machine.run("P0")
```

Important operations:

- `addCommands(commands)` adds executable handlers and their metadata/domains.
- `run(source)` resolves after queued source and procedure work drain, returning
  the output `Token[]`.
- `poll(now)` lets the host fire due `T12` exports and returns the number fired.
- `getRegisterList(class)` returns the `NamedList` for a register class.
- `getRegister(class, id, default?)` and `getMatrix(id)` resolve registers.
- `solve(primitive, options?)` lazily expands ranges and references.
- `"output"` events carry strings or tokens as they are emitted.

Default limits include `maxQueue: 1024` and `maxAsync: 16`. Limits of zero or
`undefined` disable their corresponding guard.

### Commands and hooks

A command definition combines documentation metadata with optional lifecycle
hooks:

```typescript
type Command = {
  description?: string
  args?: Record<string, CommandArgDescribed>
  responds?: Record<string, string | { description?: string }>
  records?: Record<string, Command>
  domains?: EnumDomain[]
  hookStack?: HookCallback
  hookCommand?: HookCallback
  hookCode?: HookCallback
  hookValue?: HookCallback
  hookEndArg?: HookCallback
  hookEnd?: HookCallback
}
```

Hook order is `Stack`, `Command`, then `Code` → `Value` → `EndArg` for each
argument, followed by `End`. Hook arguments include `machine`, `command`,
per-command `state`, and, where applicable, `code`, `value`, `arg`, and
`frame`.

### `Runner`

`Runner` is a FIFO request/response driver for an in-process machine or external
transport:

```typescript
import { Runner } from "gggcode"

const runner = new Runner({
  write: () => runner.feed(
    'D-50 R0 L"EnumGroup" S0 T"reference"\nOK\n'
  ),
})
const [result] = await runner.run("D5")
```

`run()` returns `Promise<RunResult[]>`, one entry for every executable input
line:

```typescript
type RunStatus = "ok" | "fail" | "timeout"

type RunResult = {
  cmd: string
  status: RunStatus
  lines: string[]
  tokens: Token[]
}
```

Options are `timeout` (default 1000 ms; zero disables it), `resultFilter`, and
`endFilter`. The default end filter accepts any O-prefixed terminator and marks
the result `fail` when that terminator carries an `F` argument.

### `NamedList`

`NamedList<T>` addresses items by numeric `index` or string `name`. `add()`
assigns either or both keys, `get()` resolves them, `setItemName()` renames an
item, and `values()` returns populated entries including sparse negative
indexes used by protocol result-record enums.

### `Matrix`

Import `Matrix` from `gggcode/ggggx`. Its primary fields are `name`, `index`,
`dim`, `size`, `storage`, and typed `data`.

Key operations:

- `resize({ dim, storage })`
- `write(values, coordinate?)`
- `read(coordinate?, defaultValue?)`
- `readNumber(coordinate?, defaultValue?)`
- `readIndex(index, defaultValue?)`
- `clearData(value?)`
- `writeImageData(imageData, options?)`
- `saveImageData(imageData?, options?)`

Coordinate conversion uses `DimOffset`; out-of-range reads return the supplied
default rather than throwing.
