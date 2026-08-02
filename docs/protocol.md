# GGGCode Self-Description Protocol

The `gggdx` subsystem lets a runtime describe the language it actually exposes.
The response is GGGCode, not prose comments or a separate serialization format,
so an ordinary GGG parser can consume it.

Use this when a host, editor, model, or remote peer needs to discover syntax,
commands, result records, enum values, and live register names without assuming
the machine is a full “kitchen sink” build.

## Bootstrap requests

Five executable requests are the only vocabulary a consumer must know in
advance:

| request | result |
| --- | --- |
| `D1` | Complete description: `D2`, then `D4`, `D5`, and `D6`, followed by one `OK`. |
| `D2` | Stable grammar rules (`D-20`) and complete valid/invalid examples (`D-21`). |
| `D4` | Command/result schemas (`D-40`), arguments (`D-41`), return relations (`D-42`), and examples (`D-45`). |
| `D5` | Enum/reference groups (`D-50`) and their entries (`D-51`). |
| `D6` | Self-contained JSON UI control descriptions (`D-60`). |

Negative D codes are emitted records. They are not executable requests. Every
request ends with the normal GGG success terminator; an `F` argument on that
terminator still means failure.

```ggg
D1
```

## Language basics: `D2`

`D-20` names one stable grammar rule. Its `T` value classifies the rule, `V`
contains a literal token or canonical form, and `A` explains it:

```text
D-20 L"list.separator" T"delimiter" V"," A"A comma separates values in one argument."
D-20 L"list.grouping" T"constraint" V"no-parentheses" A"Lists have no wrapper punctuation: write P0,0, never P(0,0)."
```

`D-21` carries a complete source line in `V`. Consumers may copy a
`T"valid"` example exactly; `T"invalid"` examples are counterexamples:

```text
D-21 T"valid" V"G20 R0 P0,0 Q1 V1,0.5 ; trailing comment" A"Lists use commas without wrappers; a trailing semicolon begins a comment."
D-21 T"invalid" V"G20 R0 P(0,0) V1" A"Parentheses are not list syntax; write P0,0."
```

Strings in these records use normal GGG quoting and escaping. An ellipsis is
never part of a wire response; examples in this guide are selected complete
records from a longer response.

## Commands and records: `D4`

A `D-40` record introduces one message schema:

```text
D-40 B"G40" T"command" S10 A"Blit (transform-copy) between buffers."
```

- `B` is the command or result-record code.
- `T"command"` means executable; `T"result"` means emitted output.
- `S` is the number of described arguments.

Each following `D-41` associates an argument with its owner through `B`:

```text
D-41 B"G40" U"R" T"reference" R"ggggx.register" A"buffer specifier"
D-41 B"G40" U"T" T"enum" R"ggggx.transform" A"Transform mode: box (default) / affine / map / offset (index or name)."
D-41 B"G40" U"M" T"number" M"comma-list:number;one-or-more" A"Transform coefficients (per mode): box = source min,max pairs; map = (srcAxis,min,max) triples per dest axis; affine = matrix; offset = source pixel offsets."
```

- `U` is the argument glyph to write on the wire.
- `T` is its semantic kind: `data`, `number`, `string`, `boolean`, `enum`, or
  `reference`.
- `R` names a domain published by `D5`.
- `M` is a canonical shape label for consumers. It describes the value; its
  punctuation must not be copied into source.
- `G1` marks an argument as required. An omitted `G` is false.

`D-42 B"G10" W"G20"` says that `G10` may return a replayable `G20` record.
Consumers should use these relations rather than guessing response types from
command numbers.

`D-45` carries a source example owned by the command named in `B`:

```text
D-45 B"G20" V"GK" A"Repeat to size."
```

Unlike the complete grammar lines in `D-21`, a `D-45` value is interpreted in
its owning command's context. It may therefore be a snippet as small as one
argument. `V` is the reusable source, while `A` carries its explanation.

## Enum and live-reference domains: `D5`

`D-50` introduces a named domain. `T"enum"` is a fixed vocabulary;
`T"reference"` is a live index/name table owned by this machine.

```text
D-50 R14 L"ggggx.transform" S4 T"enum" A"G40 transform modes."
D-51 R14 V0 L"box" A"Map a source pixel rectangle across the destination."
D-51 R14 V1 L"affine" A"Apply a homogeneous affine transform."
D-51 R14 V2 L"map" A"Map destination axes to source ranges."
D-51 R14 V3 L"offset" A"Add exact source pixel offsets."
```

`R14` is the group reference in this response. On each `D-51`, `V` is the
actual wire value or live reference index and `L` is its stable name. Values can
be sparse or negative; never replace `V` with an array position.

An argument such as G40 `R` points to `ggggx.register`, a live reference domain.
G40 `T` points to `ggggx.transform`, a fixed enum. Both are represented by the
same group/entry record shape so a consumer can build one indexed repository
while preserving their different semantics.

## UI controls: `D6`

`D6` emits zero or more `D-60` records. Each record contains exactly one
self-contained JSON object in `V`:

```text
D-60 V`{}
```

The backtick begins a string through the end of the line, allowing JSON quotes
without GGG escaping. The JSON must occupy one physical line; embedded newlines
use normal JSON escapes. gggdx treats the object as opaque and does not define
or interpret its fields. Its schema and semantics are specified separately.

Commands contribute controls to their machine's catalogue. Consequently, only
controls belonging to loaded commands are returned, in command-registration and
control-registration order.

## Capability discovery

Descriptions are machine-scoped:

- Only loaded commands appear in `D4`.
- Only domains used by those commands or their records appear in `D5`.
- Live register/procedure domains report their current index/name pairs.
- In C++, compile-time gates remove both behavior and its documentation.
- Fixed-point builds omit operator entries whose implementation is disabled.

Therefore a consumer should query the connected machine rather than cache the
repository-wide kitchen-sink catalog as if it were universally available.

## Consumer algorithm

1. Send `D1`, or send `D2`, `D4`, `D5`, and `D6` separately.
2. Parse every response line with the normal GGG parser.
3. Store `D-50` groups by both `R` and `L`.
4. Attach each `D-51` to its group and preserve its literal `V`.
5. Store every `D-40` by `B`, then attach its `D-41`, `D-42`, and `D-45` records.
6. Parse each D-60 `V` string as one JSON object using the separately defined
   control schema.
7. Use `T"result"` to prevent emitted records from being offered as executable
   commands.
8. Finish only on `OK`; treat a terminator carrying `F` as failure.

The TypeScript definitions live in
[`ts/gggdx/Protocol.ts`](https://github.com/koopero/GGGCode/blob/main/ts/gggdx/Protocol.ts)
and the enum repository in
[`ts/ggg/EnumRepository.ts`](https://github.com/koopero/GGGCode/blob/main/ts/ggg/EnumRepository.ts).
The C++ equivalents are generated under `cxx/include/gen/`.
