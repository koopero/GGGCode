# GGGCode

GGGCode (General Golly Gee Code) is a minimal, extensible meta-language inspired by G-Code. Every line is a command; every datum on the line is prefixed by a single letter that names it. Where G-Code allows only decimal numbers, GGGCode adds a rich value language — ranges and sweeps, multi-axis values, hex/normalized encodings, named constants, string literals, and references into named matrix buffers — which makes it compact and expressive for numerical and graphics/image-buffer work.

There is a TypeScript reference implementation (`ts/`) and a C++ port (`cxx/`); the two are kept in lock-step by a generated conformance corpus (see [Documentation](#documentation)).

## Documentation

| Doc | What it is |
| --- | --- |
| [docs/tour.md](docs/tour.md) | **Start here.** A guided walk through the language, numbers → ranges → references → matrices → blit → flow. |
| [docs/cases.md](docs/cases.md) | The living reference: every feature as a runnable, visualized, test-backed example (generated from `cases/*.yaml`). |
| [docs/commands.md](docs/commands.md) | Per-command reference: arguments, responses, and example links (generated from the command definitions). |
| [docs/glossary.md](docs/glossary.md) | Definitions for language concepts, argument codes, and the TypeScript API. |
| [docs/runtime.md](docs/runtime.md) | How the runtime executes: machine, parse pipeline, hooks, `Solve`, matrix registers. |
| [docs/protocol.md](docs/protocol.md) | How `D1`, `D2`, `D4`, `D5`, and `D6` describe the language as GGG records. |
| [docs/cxx.md](docs/cxx.md) | C++17 setup, numeric traits, compile-time feature gates, and embedded size notes. |

## Install and run

GGGCode requires Node.js 18.3 or newer. Install the CLI globally:

```bash
npm install --global gggcode
```

Or add the library to an application:

```bash
npm install gggcode
```

The CLI loads no command extensions implicitly. `-a` loads all built-ins; `-x`
loads one by its full name or short name (`p`, `g`, `t`, or `d`):

```bash
ggg -a program.ggg
ggg -x p numbers.ggg
ggg -x g image.gggx
```

## Basic syntax

```text
Command Arguments ; Comment
```

A command is a letter followed by a number (`P10`, `G40`). The remaining arguments are each a code letter followed by data (`V1,2,3`, `R"img"`). Comments run from `;` to end of line.

## First programs

Print some numbers, then a range, then a divided range. The documentation
examples execute in the test suite; their focused behavioral cases live in the
[case reference](docs/cases.md).

```ggg
P10 V1,2,3        ; -> 1,2,3      (print_list)
P10 V1:5          ; -> 1,2,3,4,5  (range_incl, inclusive range)
P10 V0:10/5       ; -> 0,2.5,5,7.5,10  (range_count, range divided into 5 points)
```

Write into a matrix buffer and read it back:

```ggg
G30 R0 L"numbers" S3
G20 R0 P0 V7,8,9  ; write 7,8,9 at offset 0 of register 0
G10 R0 P0 S3      ; -> 7,8,9      (matrix_write_read)
```

Blit (transform-copy) one buffer into another — here a horizontal flip:

```ggg
G30 L"source" S3,3
G30 L"dest" S3,3
G20 R"source" V1:9
G40 R"source" W"dest" T"box" M2.5,-0.5,0,3 F1
G10 R"dest" ; -> 3,2,1,6,5,4,9,8,7  (blit_box_flip_x)
```

See the [tour](docs/tour.md) for the full progression, with diagrams.

## CLI image output

With the graphics extension loaded, `-o` / `--output` writes the matrix from
each `G13` display command as a PNG. Use `%d` for a zero-based frame number or
add zero-padding, such as `%04d`:

```bash
ggg -a --output frame-%04d.png animation.gggx
# frame-0000.png, frame-0001.png, ...
```

A path without a frame marker, such as `--output latest.png`, is overwritten
on each `G13` and therefore contains the most recent frame.

## Arguments

- **Numbers**
  - Decimal: `123`, `-45.67`, `1.23e-4`
  - Hex integer: `0X1F` → `31`. Any width, read as one number (`0X100` → `256`).
  - **Hex lists** — everything after the prefix is split into fixed-width groups of
    hex digits, *one value per group*, so a single token carries a whole list of
    numbers. The prefix picks the group width and whether values are raw or
    normalized to 0..1:

    | prefix | digits per value | value range | example |
    | --- | --- | --- | --- |
    | `0I` | 1 | `0`–`15` | `0I5A` → `5, 10` |
    | `0G` | 2 | `0`–`255` | `0G5A3B` → `90, 59` |
    | `0J` | 1 | `0`–`1` (*n*/15) | `0J8` → `0.5333` |
    | `0H` | 2 | `0`–`1` (*n*/255) | `0H80` → `0.5020` |

    So `0I` and `0G` decode raw integers, while `0J` and `0H` divide by the widest
    value the group can hold — `0JF` and `0HFF` are both exactly `1`. The list is
    as long as you make it: `0IFF00` → `15, 15, 0, 0`.
- **Strings**
  - Quoted: `"Hello, world!"`
  - To end of line: `` `Rest of line becomes string``
- **Unitary constants** — named numeric literals (ASCII forms case-insensitive):
  `K`=1, `Z`=0, `N`=−1, `π`=Pi, `τ`=2π, `φ`=golden ratio, `γ`=Euler–Mascheroni,
  `∞`=infinity. A leading sign negates one: `-π` is −3.14159, `-N` is 1.
- **Unicode characters** — every *other* non-ASCII character is a numeric literal
  for its Unicode code point, and lists like any other value:

  ```ggg
  P10 V☃            ; -> 9731
  P10 V你            ; -> 20320
  P10 V€            ; -> 8364
  P10 V😀            ; -> 128512      (astral plane: the full code point)
  P10 V☃,你          ; -> 9731,20320
  ```

  The constants above are the only exception, and they are otherwise unremarkable
  letters — `α` is `945` and `β` is `946`, but `γ` is a named constant, so it
  gives `0.5772…` rather than `947`. A sign negates a code point too: `-☃` is
  `-9731`.
- **References** into named buffers: `$name`, indexed `$name[1]`, ranged `$name[0:2]`, multi-axis `$name[a|b]`, or offsets `$name@[...]`
- **Registers** are always addressed by `R` — `R0` by index or `R"img"` by name, for matrix
  buffers and procedure bodies alike. `L` never selects; it only assigns a name where one is
  created or edited (`G30`, `T10`).

### Ranges

- **Inclusive / exclusive**: `1:10` (includes 10), `1>10` (stops before 10)
- **Open-ended**: `1:` or `1>` — an omitted end runs to the dimension of the
  matrix the range is resolved against, so it sweeps to the end of that buffer.
  The two spellings differ only in whether the endpoint itself is included, which
  lands on the same values:

  ```ggg
  G30 L"q" S5
  G20 R"q" V10,20,30,40,50
  P10 V$q[1:]       ; -> 20,30,40,50   (index 1 through the last element)
  P10 V$q[1>]       ; -> 20,30,40,50
  P10 V$q[0:]       ; -> 10,20,30,40,50
  ```

  An open range needs a dimension to run to. In a plain value context there is no
  matrix, so it has no extent and stays a single point:

  ```ggg
  P10 V1:           ; -> 1
  ```

  Only the open *end* consults the matrix — coordinates stay register-less, so
  `$q[a|b]` remains a flat coordinate-wise expansion.
- **Count**: `1:10/4` (range divided into 4 points)
- **Step**: `0:10:2`
- **Multiplier**: `5*3`
- **Multi-axis**: `1|2|3` (axes combined coordinate-wise)
- **Lists**: `1,2,3`

Each component is routed by the symbol in front of it rather than by position, so
components can be skipped: `2*10` is a multiplier with no range, and `10:30:4:3`
fills end, step and multiplier in turn.

## Extensions

The core language (`ts/ggg/`) is data + dispatch only; behaviour comes from command sets:

- **ggggx** — graphics / matrix buffers (init, read, write, blit)
- **gggpx** — print / processing
- **gggtx** — flow control (procedures, conditionals, iteration, async export)
- **gggdx** — structured protocol self-description (`D1` complete, `D2` basics, `D4` commands, `D5` enums, `D6` controls)

`D2` returns `D-20` stable core grammar rules and `D-21` complete valid or
invalid wire examples. `D4` returns `D-40` command/record schemas, `D-41`
argument schemas, `D-42` command-to-command return relations, and `D-45`
command-relative source examples. `D5` returns `D-50` groups and `D-51`
entries, with `V` carrying the actual (possibly sparse or negative) wire value.
`D6` returns one opaque, self-contained JSON UI object per `D-60` record. `D1`
describes the complete language by returning the D2, D4, D5, and D6 sections in
that order with one final `OK`. These are ordinary GGG records rather than
comments. Argument
schemas distinguish fixed `enum` domains from live `reference` domains, so for
example G40 reports `R` against `ggggx.register` and `T` against
`ggggx.transform`. Each `D-40` carries `T"command"` for executable requests or
`T"result"` for non-executable output records. A D-41 `M` value is a canonical
non-literal shape label such as `comma-list:axes=C,X,Y,Z`; its punctuation is
never copied into a command. The catalog includes all nine result records themselves,
leaving only the `D1`/`D2`/`D4`/`D5`/`D6` request codes as bootstrap
knowledge. A return relation is written as `D-42 B"G10" W"G20"`, where `B` is
the originating command and `W` is the command it returns.
An example is written as `D-45 B"G20" V"GK" A"Repeat to size."`. `B` supplies
the command context, so `V` may be an argument-sized snippet rather than a
complete executable line; `A` explains it separately.

TypeScript hosts can turn complete D1 wire text, `Runner` tokens, or direct
`Machine.run()` output into linked lookups with `ParseLanguageDescription`:

```ts
const language = ParseLanguageDescription( d1Output )
language.commands.G20.args.R.domain       // ggggx.register
language.records["D-60"]                  // emitted control schema
language.domains["ggggx.operator"].valuesByName.add
language.controls                         // parsed JSON control objects
```

The C++17 runtime can be assembled from the same subsystem boundaries with
compile-time feature gates. See the [C++ guide](docs/cxx.md) for a compiling
example, numeric traits, all flags, and measured ESP32 size effects.

## Implementing custom commands

For a ready-to-run TypeScript host with every built-in subsystem installed,
use `KitchenSinkMachine`. It includes `gggpx`, `ggggx`, `gggtx`, and `gggdx`,
so loopbacks and interactive hosts expose the same complete machine that the
CLI loads with `--all`:

```typescript
import { KitchenSinkMachine } from "gggcode"

const machine = new KitchenSinkMachine()
await machine.run( 'G30 L"frame" S1,8,8' )
await machine.run( "D1" )
```

Constructor options are the normal `Machine` options. Additional `commands`
extend or override the kitchen-sink defaults.

Define a command set, create a `Machine`, and run code. A command supplies hooks at the points the parser reaches (`Command` → `Code` → `Value` → `End`):

```typescript
import { Machine, Hooks } from "gggcode"

const commands = {
  "P0": {
    description: "Print each value",
    [Hooks.Value]: ( { value } ) => console.log( value ),
  },
}

const machine = new Machine( { commands } )
machine.run( "P0 V1,2,3" )
```

See [docs/runtime.md](docs/runtime.md) for the full hook lifecycle and execution model.

## Development

```bash
npm test                 # TypeScript conformance suite (jest)
npm run build:conformance # regenerate golden.json, cases.md, commands.md, C++ header
npm run build:docs        # regenerate docs/cases.md + docs/img/*.svg
npm run build:commands    # regenerate docs/commands.md
npm run check:codegen     # CI: verify all generated artifacts are fresh
```

Cases live in `cases/*.yaml`; each is simultaneously a spec, a doc example, and a cross-engine conformance test. Add or edit a case there and regenerate.

## License

ISC License. Contributions welcome.
