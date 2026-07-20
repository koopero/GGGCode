# GGGCode Runtime

How a GGGCode program actually executes — the machine, the parse pipeline, the command-hook
lifecycle, value expansion, and matrix registers. For the language itself see the
[tour](tour.md); for individual commands see the [command reference](commands.md); for
vocabulary see the [glossary](glossary.md). File references point at the TypeScript
reference implementation under `ts/ggg/`.

## The machine

`Machine` ([Machine.ts](../ts/ggg/Machine.ts)) is the execution engine. It holds:

- a **queue** of work items (`queue`, `queuePointer`) — parsed lines plus callback items;
- a **stack** of control frames (`stack`) — used by flow control to capture/skip blocks;
- shared **state** (`state`) and per-command state (`commandState`);
- a **register** store, reached via `getRegisterList(class)` (see [Registers](#matrix-registers));
- output, emitted as an `"output"` event and via `output()` / `outputOk()` / `outputFail()`.

`run(code)` parses the source into line tokens, pushes them onto the queue, and ticks
through it. Because items execute from a queue with a moving pointer, a command can splice
*new* lines in to run next — `enqueueLines()` (procedure bodies) and `enqueueLoop()`
(iteration) do exactly this, which is how flow control composes without the core language
having loops. Growth is bounded by `limits.maxQueue`.

Each command returns a control line. By default that is `OK`; a request id set with
`O<id>` on the line is captured (`requestId`) and echoed back; a failure is emitted by
`outputFail(code)` as an `F<code>` argument (codes in `GGGFail`, listed in
[commands.md](commands.md#responses--failures)).

## Parse pipeline

Parsing is layered, each layer in its own file:

```
ParseLines  -> split source into lines               (ParseLines.ts)
  ParseLine -> command + comment + argument tokens    (ParseLine.ts)
    ParseArg  -> one code-letter argument             (ParseArg.ts)
      ParseData -> the value language inside an arg    (ParseData.ts)
```

`ParseData` is where the richness lives: it tokenizes numbers, hex/normalized encodings,
unitary constants, strings, ranges (`:`, `>`, `/`, `*`), multi-axis (`|`), lists (`,`), and
references (`$name`, subscripts, `@` offsets) into a flat `Primitive[]`.

There are two front ends over the same grammar: batch `ParseLines`, and a character-by-
character `StreamParser` ([StreamParser.ts](../ts/ggg/StreamParser.ts)) for incremental /
REPL input. Both produce the same `Token` shape.

## Value expansion: `Solve`

Parsing produces `Primitive`s — including unexpanded ranges and references — not final
numbers. `Solve` ([Solve.ts](../ts/ggg/Solve.ts)) is a **generator** that lazily expands a
primitive into the concrete stream a command consumes. Nothing is materialized until a hook
pulls it:

- a `RangeAxis` (`1:5`, `0:10/5`) expands to a stream of scalars;
- a `RangeAxes` (multi-axis, `a|b`) expands coordinate-wise;
- a `Reference` reads values (or, with `@`, flat offsets) from a register.

Because `Solve` is lazy, a sweep like `$frame[0:640|0:480]` never builds an intermediate
array — values flow one at a time into the command's `Value` hook.

## Command-hook lifecycle

A command is an object of hooks ([Language.ts](../ts/ggg/Language.ts), `Command`). As
`execLine` walks a formalized line it calls them in order:

```
hookStack    (control frames only: Run / Capture / Skip / Error — decides the line's fate)
hookCommand  once, before arguments
  hookCode     once per argument, when its code letter is known
    hookValue    once per solved value under that argument
  hookEndArg   once per argument, after its values
hookEnd       once, after all arguments
```

`hookStack` is what flow control uses: a `T10`/`T9` frame returns `Capture` to swallow
following lines into a block body, `Skip` to drop them, or `Run` to let them dispatch
normally (see [gggtxCommands.ts](../ts/gggtx/gggtxCommands.ts)). The other hooks let a
command stream-process values without buffering — e.g. `P10` formats each value as it
arrives, and the matrix write commits values into a buffer one at a time. A hook receives
`{ machine, command, state, code, value, frame }`.

## Matrix registers

Buffers are `Matrix` instances ([Matrix.ts](../ts/ggg/Matrix.ts)): a typed,
multi-dimensional array with `dim` (dimensions, component-first — `dim[0]` is the
innermost/stride-1 axis) and flat `data`. Coordinates map to flat offsets via the `Dim*`
helpers ([Dim.ts](../ts/ggg/Dim.ts)); out-of-bounds reads degrade rather than throw.

Registers are addressable by both index (`R0`) and name (`L"img"` / `$name`) through a
shared `NamedList` ([NamedList.ts](../ts/ggg/NamedList.ts)). `getRegisterList(class)`
returns the list for a register class — buffers are keyed by `Matrix`, procedure bodies by
their own marker, so different subsystems share the addressing without colliding. `G10`
reads a buffer back as a replayable `G20` write, which makes matrices round-trippable as
source text.

## Subsystems and the C++ port

The core (`ts/ggg/`) is data + dispatch only; behaviour is supplied as command sets loaded
by subsystem: `ggggx` (graphics/matrix), `gggpx` (print), `gggtx` (flow). A case declares
which it `needs`; the conformance harness loads exactly that union
([conformance.ts](../ts/cxx/conformance.ts)).

The C++ port (`cxx/`) mirrors the TypeScript reference. Shared enums, operator tables, and
storage descriptors are **generated** from the TS source of truth (`buildCxxDefs`), and the
conformance corpus (`cases/*.yaml`) is compiled into a C++ test table (`buildConformance`).
The two engines agree on each case's decoded `values` within a global epsilon; byte-exact
output is asserted only where a case opts in. This is why behaviour documented in
[cases.md](cases.md) holds for both engines.
