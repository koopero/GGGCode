# GGGCode Glossary

Definitions for GGGCode language concepts, runtime types, and TypeScript interfaces.

See also: [tour](tour.md) · [cases](cases.md) (worked, tested examples) · [commands](commands.md) · [runtime](runtime.md).

---

## Language Concepts

### Argument

An argument is a single code-letter followed by data values, appearing after the command on a line. Arguments are separated by spaces.

```
G0 X10 Y20 Z5
   ^^^           ; argument: code=X, data=10
       ^^^       ; argument: code=Y, data=20
```

The first argument's code letter combined with the initial letter forms the **Command** name (e.g., `G` + `0` → `G0`). Subsequent arguments carry named parameters.

---

### Code

A single uppercase letter that names an argument within a command. For example, `X`, `Y`, `Z`, `S`, `V`. The code gives meaning to the data that follows it — whether it represents a position, speed, string, value, etc. — as defined by the command's implementation.

---

### Command

A command is a complete executable instruction: a letter followed by a numeric suffix, e.g. `G0`, `M104`, `P0`. Commands are case-insensitive. The specific commands available depend on the language extension or machine configuration. Each line of GGGCode is typically one command.

```
G0 X10 Y20     ; command G0 with X and Y arguments
```

---

### Comment

Comments begin with `;` and extend to the end of the line. They are ignored during execution but can be preserved in parsed tokens when `keepComments` is set.

```
G0 X10 ; move to x=10
```

---

### Line

A single line of GGGCode text, containing one command with its arguments and optional comment. Lines are parsed independently and executed sequentially.

---

### Range

A compact notation for generating sequences of numbers.

| Syntax    | Meaning                                  |
|-----------|------------------------------------------|
| `1:10`    | Inclusive range: 1, 2, 3, ..., 10       |
| `1>10`    | Uninclusive (exclusive end): 1, 2, ..., 9 |
| `1:10/4`  | Range divided into 4 steps              |
| `0:/4`    | Open range from 0, divided into 4 steps |
| `5*3`     | Multiplied value: 15                     |

Ranges are parsed into `RangeAxis` objects and expanded by `Solve`. Examples: [ranges](cases.md#ranges).

---

### Multi-Axis

The `|` operator separates values across dimensions within a single argument:

```
V1|2|3    ; three separate axis values
```

Parsed as a `RangeAxes` object containing one `RangeAxis` per axis. Examples: [multiaxis](cases.md#multiaxis).

---

### List

Comma-separated values within a single argument:

```
V1,2,3    ; list of three values
```

---

### Reference

A variable-length reference to a named register, optionally subscripted to access specific elements of a Matrix.

```
$myMatrix         ; reference to register named "myMatrix"
$myMatrix[1,2]    ; subscripted reference: element at [1,2]
```

Parsed as a `Reference` object. The subscript is an array of `Numeric` values. Examples: [references](cases.md#references), [subscript](cases.md#subscript), [offset](cases.md#offset).

---

### Unitary Constant

Named numeric literals that can appear as data values. Case-insensitive for ASCII names.

| Token | Value                      |
|-------|----------------------------|
| `K`   | 1                          |
| `Z`   | 0                          |
| `N`   | -1                         |
| `π`   | π ≈ 3.14159                |
| `τ`   | 2π ≈ 6.28318               |
| `φ`   | Golden ratio ≈ 1.61803     |
| `γ`   | Euler-Mascheroni ≈ 0.57722 |
| `∞`   | Infinity                   |

A leading sign negates a constant (`-π` is −3.14159, `-N` is 1) or a code point (`-☃` is −9731).

Examples: [unitary](cases.md#unitary).

---

### Number Formats

GGGCode supports multiple numeric representations:

| Format         | Example   | Description                                         |
|----------------|-----------|-----------------------------------------------------|
| Decimal        | `123`     | Integer or floating point, scientific notation ok   |
| Hex            | `0X1F`    | Standard hexadecimal integer                        |
| Hex list (1)   | `0I5A`    | Pairs of 1-digit hex values                         |
| Hex list (2)   | `0G5A3B`  | Pairs of 2-digit hex values                         |
| Hex norm (1)   | `0J80`    | 1-digit hex normalized to 0–1 (÷ 0xF)              |
| Hex norm (2)   | `0H8040`  | 2-digit hex normalized to 0–1 (÷ 0xFF)             |

Examples: [hex](cases.md#hex), [normalized](cases.md#normalized).

---

### String

String values appear in two forms:

- **Quoted**: `"Hello, world!"` — delimited by double quotes, supports escape sequences.
- **To-EOL**: `` `Rest of line `` — backtick introduces a string that runs to the end of the line.

---

## TypeScript Types and Interfaces

### `Dimensions`

```typescript
type Dimensions = number[]
```

An array of integers specifying the size of each axis of a multi-dimensional array. For example, `[3, 640, 480]` represents a 3-channel 640×480 grid. Trailing `1`s are typically stripped.

---

### `DimArg`

```typescript
type DimArg = number | number[]
```

A flexible argument type for specifying dimensions — either a single number (1D) or an array (N-D). Normalized to `Dimensions` by `DimFrom`.

---

### `EncodingName`

```typescript
type EncodingName = string
```

A string identifier for a numeric encoding scheme. Valid values correspond to the `GGG` enum codes: `"A"` (decimal), `"X"` (hex), `"H"` (2-digit normalized hex), etc.

---

### `Numeric`

```typescript
type Numeric = number | RangeAxes | RangeAxis
```

Any type that can produce one or more numbers. Either a plain number, a single-axis range, or a multi-axis range.

---

### `Primitive`

```typescript
type Primitive = boolean | string | Numeric | ValueWithEncoding | Reference
```

The set of value types that can appear as data in a parsed argument. The union covers all possible data tokens: booleans (`true` → 1), strings, numbers, ranges, encoded values, and register references.

---

### `ParseOptions`

```typescript
type ParseOptions = {
  lineSizeMax?: number
  keepEncoding?: boolean
  keepComments?: boolean
}
```

Options for the parse pipeline:

- `lineSizeMax` — maximum characters per line before truncation.
- `keepEncoding` — if true, attach the encoding name to parsed tokens.
- `keepComments` — if true, preserve comment text in the `Token.comment` field.

---

### `RangeAxis`

```typescript
type RangeAxis = {
  start: number
  end: number
  step: number
  count: number
  multiplier: number
  inclusive: boolean
}
```

Describes a single sequence axis. `Solve` expands a `RangeAxis` into a stream of numbers by stepping from `start` toward `end`. Either `step` or `count` controls the stride; if both are zero, step defaults to 1. `inclusive` controls whether `end` itself is yielded.

---

### `RangeAxes`

```typescript
type RangeAxes = {
  axes: RangeAxis[]
}
```

A multi-axis range, produced by the `|` operator. Each element of `axes` is a separate `RangeAxis`. `Solve` generates coordinate tuples across all axes.

---

### `Reference`

```typescript
type Reference = {
  register: string
  subscript: Numeric[]
}
```

A reference to a named register (e.g., a Matrix) with an optional subscript for element access. `register` is the name after `$`. `subscript` is the coordinate list inside `[…]`.

---

### `Token`

```typescript
type Token = {
  code?: string
  index?: number
  row?: number
  col?: number
  len?: number
  encoding?: EncodingName
  comment?: string
  command?: string
  args?: Token[]
  data?: Primitive | Primitive[]
}
```

The universal parse tree node. Used at every level:

- A **line token** has `command` and `args`.
- An **argument token** has `code` and `data`.
- A **data token** has `data` (a primitive or array of primitives).

`row`/`col`/`len` carry source position. `encoding` carries the active encoding when `keepEncoding` is on.

---

### `TokenArg`

```typescript
type TokenArg = string | Token
```

A hook argument can be a raw string (unparsed) or a parsed `Token`.

---

### `ValueWithEncoding`

```typescript
type ValueWithEncoding = {
  value: number | string
  encoding: EncodingName
}
```

A value annotated with how it should be represented when serialized back to GGGCode. Used when a specific numeric format (hex, normalized, etc.) must be preserved round-trip.

---

### `Command`

```typescript
type Command = Described & {
  name?: string
  hookStack?: HookCallback
  hookCommand?: HookCallback
  hookCode?: HookCallback
  hookValue?: HookCallback
  hookEndArg?: HookCallback
  hookEnd?: HookCallback
}
```

A command definition object registered with the `Machine`. Each hook property is an optional async callback fired at the corresponding point during execution (see `Hooks`).

---

### `Commands`

```typescript
type Commands = { [key: string]: Command }
```

A map of command names to their definitions, passed to `Machine.addCommands`.

---

### `HookArgs`

```typescript
type HookArgs = {
  machine?: Machine
  command: string
  state: { [key: string]: any }
  code?: string
  value?: number | string
  arg?: TokenArg
}
```

The argument passed to every hook callback. `state` is the per-command state bag for the current execution. `code` is the current argument's code letter. `value` is the current solved scalar value.

---

### `MatrixProps`

```typescript
type MatrixProps = string | number | {
  storage?: StorageProps
  index?: number
  name?: string
  dim?: DimArg
  data?: number[]
}
```

Constructor argument for `Matrix`. A plain number or string is shorthand for `{ storage: value }`.

---

### `VecArg`

```typescript
type VecArg = number | number[]
```

A scalar or vector value used in graphics extension operations.

---

## Enums

### `GGG`

Single-character codes used as internal identifiers in the parse pipeline. These appear as the `code` field of tokens or as markers in the stream parser state machine.

| Name         | Char  | Role                                         |
|--------------|-------|----------------------------------------------|
| `Data`       | `A`   | Raw decimal data                             |
| `Command`    | `B`   | Command token marker                         |
| `Code`       | `C`   | Argument code letter                         |
| `Argument`   | `U`   | Argument boundary marker                     |
| `End`        | `\n`  | End of line                                  |
| `Comment`    | `;`   | Start of comment                             |
| `Value`      | `V`   | Generic value code                           |
| `Size`       | `S`   | Size parameter code                          |
| `Offset`     | `P`   | Offset parameter code                        |
| `Number`     | `+`   | Decimal number token                         |
| `HexNumber`  | `X`   | Hex number prefix                            |
| `HexList1`   | `I`   | 1-digit hex list prefix                      |
| `HexList2`   | `G`   | 2-digit hex list prefix                      |
| `HexNorm1`   | `J`   | 1-digit normalized hex prefix                |
| `HexNorm2`   | `H`   | 2-digit normalized hex prefix                |
| `EncodedOne` | `K`   | Unitary value (also the symbol for 1)        |
| `Dimension`  | `D`   | Dimension specifier                          |
| `Encoding`   | `E`   | Encoding specifier                           |
| `Storage`    | `T`   | Storage type specifier                       |
| `Register`   | `R`   | Register reference                           |
| `Reference`  | `$`   | Reference prefix in source                   |
| `Range`      | `:`   | Inclusive range operator                     |
| `Uninclusive`| `>`   | Exclusive range operator                     |
| `Multiplier` | `*`   | Multiplication operator                      |
| `Count`      | `/`   | Count/step operator                          |
| `NextAxis`   | `\|`  | Multi-axis separator                         |
| `Okay`       | `O`   | Success response code                        |
| `Failure`    | `F`   | Failure response code                        |
| `Quote`      | `"`   | String delimiter                             |
| `StringToEOL`| `` ` ``| To-end-of-line string prefix               |
| `Comma`      | `,`   | List separator                               |
| `Subscript`  | `[`   | Subscript open                               |
| `SubscriptEnd`| `]`  | Subscript close                              |
| `Escape`     | `\`   | Escape character inside strings              |

---

### `UnitaryNames`

Enum of single-character tokens representing named mathematical constants. See **Unitary Constant** above.

---

### `Hooks`

Lifecycle hooks fired during command execution. Each value is the property name on a `Command` object.

| Hook          | When it fires                                              |
|---------------|------------------------------------------------------------|
| `Stack`       | Before the next queued command executes (stack context)   |
| `Command`     | When the command begins execution                          |
| `Code`        | For each argument code letter encountered                  |
| `Value`       | For each solved scalar value within an argument            |
| `EndArg`      | After all values of an argument have been processed        |
| `End`         | After all arguments of the command have been processed     |

---

### `CommandConvention`

Numeric priority values used to categorize and order commands by semantic role.

| Name              | Value | Purpose                              |
|-------------------|-------|--------------------------------------|
| `Init`            | 30    | Initialization commands              |
| `Write`           | 20    | Write data to a register/matrix      |
| `Watch`           | 25    | Observe or monitor state             |
| `Output`          | 15    | Emit output data                     |
| `Display`         | 13    | Render or display data               |
| `Read`            | 10    | Read from a register/matrix          |
| `List`            | 1     | List available items                 |
| `ReadResponse`    | -10   | Response to a read command           |
| `DisplayResponse` | -13   | Response to a display command        |
| `ListResponse`    | -1    | Response to a list command           |

---

## Core Classes

### `Matrix`

A multi-dimensional typed array, the primary data container in GGGCode. Matrices are identified by name and numeric index and stored in the machine's register map.

**Key fields:**

| Field     | Type           | Description                                   |
|-----------|----------------|-----------------------------------------------|
| `name`    | `string`       | Human-readable register name                  |
| `index`   | `number`       | Numeric register ID                           |
| `size`    | `number`       | Total element count (product of dimensions)   |
| `dim`     | `Dimensions`   | Array of axis sizes, e.g. `[3, 640, 480]`    |
| `data`    | `TypedArray`   | Raw storage (type determined by `storage`)    |
| `storage` | `StorageType`  | Encoding format (8-bit int, float, normalized, etc.) |

**Access patterns:**

- `read(coord)` / `write(value, coord)` — coordinate-based element access.
- `readNumber(coord)` — returns a single number, validates bounds.
- `readIndex(index)` — linear index access.
- `clearData(value)` — fill entire matrix with a constant.

**Image interop:**

- `writeImageData(imageData)` — load pixel data from an `ImageData` object.
- `saveImageData()` — export current data as `ImageData`.

**Serialization:**

- `saveCode(options)` — emit a series of GGGCode `Token` objects that reconstruct the matrix's current state.

Matrices fire events (via `EventEmitter`) when data changes, allowing dependent views or computations to update.

---

### `Machine`

The runtime execution engine. Parses GGGCode text, dispatches commands to registered handlers, manages state, and produces output tokens.

**Responsibilities:**

- **Command registry**: `addCommands(commands)` registers `Command` objects by name.
- **Register map**: holds named `Matrix` instances and other typed registers via `getRegister` / `getMatrix`.
- **Execution**: `run(code)` parses lines, queues them, and returns `Promise<Token[]>` containing all output.
- **State**: `state` is a global dictionary; `commandState` holds per-command scratch space.
- **Value expansion**: `solve(arg, options)` is a generator that calls `Solve` and resolves `Reference` objects against the register map.
- **Output**: `output(tokens)` emits response tokens; `outputOk(comment)` emits the `O<id>` return (the request id, default 1 → `OK`), and `outputFail(code, comment)` adds an `F<code>` arg to mark failure.

**Hook dispatch order for each command:**

1. `hookStack` — if a stack context is active
2. `hookCommand` — command start
3. For each argument:
   - `hookCode` — argument code
   - `hookValue` — for each solved value
   - `hookEndArg` — argument end
4. `hookEnd` — command end

---

### `Runner`

A bidirectional request/response coordinator that sits above a `Machine`. Serializes commands into a queue, correlates responses, and resolves promises when a matching end condition is met.

**API:**

- `run(cmd, options)` — enqueue a command string, return `Promise<RunResult>`.
- `attachMachine(machine)` — wire the runner to a machine for integrated operation.

**Options:**

| Field          | Default | Description                                        |
|----------------|---------|----------------------------------------------------|
| `timeout`      | 1000 ms | Maximum wait before resolving with `status: 'timeout'` |
| `resultFilter` | all     | Pattern to match response tokens to capture        |
| `endFilter`    | `"O"`   | Pattern that signals the command is complete       |

**Result:**

```typescript
{
  status: 'ok' | 'timeout' | 'error'
  result: Token[]
  timeout: number
  timeoutActual: number
}
```

---

## Parsing Pipeline

Parsing proceeds through four layers, each building on the previous.

### `ParseData`

Parses a raw string of data tokens into an array of `Primitive` values. Handles all number formats, strings, unitary constants, references, ranges, multi-axis values, and lists.

---

### `ParseArg`

Parses a single argument string (code letter + data) into a `Token` with `code` and `data` fields.

---

### `ParseLine`

Parses a complete command line into a `Token` with `command`, `args`, and optional `comment`.

---

### `ParseLines`

Batch-parses multiple lines. Accepts a string, string array, or existing `Token`/`Token[]`, and returns an array of line `Token`s with `row` numbers.

---

### `StreamParser`

A character-by-character incremental parser implemented as a state machine. Suitable for streaming input where the full text may not be available at once.

Exposes callbacks: `hookCommand`, `hookCode`, `hookValue`, `hookArg`, `hookEnd`.

`TokenParser` wraps `StreamParser` to produce structured `Token` trees. The top-level async function `parseLines(text, options)` uses this path to return `Token[]`.

---

## Supporting Systems

### `Solve`

A generator function that expands a `Primitive` (or array of primitives) into a sequence of concrete `number | string` values.

- Plain numbers pass through unchanged.
- `true` → `1`.
- `RangeAxis` → sequence of numbers from `start` to `end`.
- `RangeAxes` → coordinate tuples across all axes.
- `Reference` → element(s) read from the named Matrix register.
- Arrays are recursively expanded element by element.

`Solve` is the bridge between the abstract parse tree and the concrete values that command hooks receive.

---

### Encoding (`Encoding.ts`)

Defines and selects numeric encoding schemes. `EncodingShortest(values, allowQuantize)` inspects a set of values and picks the most compact representation (e.g., normalized hex if values are all in 0–1, unitary if only −1/0/1).

---

### Format (`Format.ts`)

Serializes `Token` trees back to GGGCode text. The inverse of the parse pipeline. `Format(token)` is the main entry point; helpers handle individual data types (`FormatNumber`, `FormatRangeAxis`, `FormatReference`, etc.).

---

### Dimension Utilities (`Dim.ts`)

Helpers for N-dimensional coordinate arithmetic.

| Function                | Description                                              |
|-------------------------|----------------------------------------------------------|
| `DimFrom(dim)`          | Normalize a `DimArg` to a `Dimensions` array            |
| `DimSize(dim)`          | Total element count (product of all axes)               |
| `DimOffset(dim, coord)` | Convert N-D coordinate to linear index; −1 if out of bounds |
| `DimPad(dim, length)`   | Pad with trailing 1s to reach required rank             |
| `DimIterate(dim, step)` | Generator yielding all coordinate arrays in row-major order |

---

### `NamedList`

A generic dual-keyed collection where items are accessible by either a numeric index or a string name. Used internally for register maps and command collections.

---

## Extensions

GGGCode's command set is open-ended. The following extension namespaces are defined in this codebase:

| Namespace  | Purpose                         |
|------------|---------------------------------|
| `ggggx`    | Graphics and image operations   |
| `gggpx`    | Processing / print operations   |
| `gggtx`    | Text processing                 |
| `gggdx`    | Documentation                   |
| `gggvx`    | Variable / value operations     |
| `gggcx`    | Custom / misc extensions        |
