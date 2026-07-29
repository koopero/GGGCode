# GGGCode Runtime

How a GGGCode program actually executes — the machine, the parse pipeline, the command-hook
lifecycle, value expansion, and matrix registers. For the language itself see the
[tour](tour.md); for individual commands see the [command reference](commands.md); for
vocabulary see the [glossary](glossary.md). File references point at the TypeScript
reference implementation in the
[repository](https://github.com/koopero/GGGCode/tree/main/ts).

## The machine

`Machine` ([Machine.ts](https://github.com/koopero/GGGCode/blob/main/ts/ggg/Machine.ts))
is the execution engine. It holds:

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
character `StreamParser`
([StreamParser.ts](https://github.com/koopero/GGGCode/blob/main/ts/ggg/StreamParser.ts))
for incremental or REPL input. Both produce the same `Token` shape.

## Value expansion: `Solve`

Parsing produces `Primitive`s — including unexpanded ranges and references — not final
numbers. `Solve`
([Solve.ts](https://github.com/koopero/GGGCode/blob/main/ts/ggg/Solve.ts))
is a **generator** that lazily expands a
primitive into the concrete stream a command consumes. Nothing is materialized until a hook
pulls it:

- a `RangeAxis` (`1:5`, `0:10/5`) expands to a stream of scalars;
- a `RangeAxes` (multi-axis, `a|b`) expands coordinate-wise;
- a `Reference` reads values (or, with `@`, flat offsets) from a register.

Because `Solve` is lazy, a sweep like `$frame[0:640|0:480]` never builds an intermediate
array — values flow one at a time into the command's `Value` hook.

## Command-hook lifecycle

A command is an object of hooks
([Language.ts](https://github.com/koopero/GGGCode/blob/main/ts/ggg/Language.ts),
`Command`). As
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
normally (see
[gggtxCommands.ts](https://github.com/koopero/GGGCode/blob/main/ts/gggtx/gggtxCommands.ts)).
The other hooks let a
command stream-process values without buffering — e.g. `P10` formats each value as it
arrives, and the matrix write commits values into a buffer one at a time. A hook receives
`{ machine, command, state, code, value, frame }`.

## Matrix registers

Buffers are `Matrix` instances
([Matrix.ts](https://github.com/koopero/GGGCode/blob/main/ts/ggg/Matrix.ts)): a typed,
multi-dimensional array with `dim` (dimensions, component-first — `dim[0]` is the
innermost/stride-1 axis) and flat `data`. Coordinates map to flat offsets via the `Dim*`
helpers ([Dim.ts](https://github.com/koopero/GGGCode/blob/main/ts/ggg/Dim.ts));
out-of-bounds reads degrade rather than throw.

Commands select registers by index (`R0`) or name (`R"img"`). `L"img"` only
assigns or changes a name on commands that create or edit a register; `$img`
reads its values inside an argument. All three forms resolve through a shared
`NamedList`
([NamedList.ts](https://github.com/koopero/GGGCode/blob/main/ts/ggg/NamedList.ts)).
`getRegisterList(class)`
returns the list for a register class — buffers are keyed by `Matrix`, procedure bodies by
their own marker, so different subsystems share the addressing without colliding. `G10`
reads a buffer back as a replayable `G20` write, which makes matrices round-trippable as
source text.

## Async procedures: repetition lives in the host

`T9 V` provides bounded, materialized iteration. GGG deliberately has no
unbounded in-language loop: one on embedded hardware could monopolize the
device until reset. Open-ended repetition instead comes from exporting a
procedure and letting the **host** run it.

```ggg
T10 L"blink"          ; define
  P10 V1
T0
T12 R"blink" S500 G10 ; every 500ms, 10 times
T12 R"blink" S500     ; every 500ms, forever
T12 R"blink" G0       ; cancel
```

`T12` does not run anything. It adds the procedure to the machine's schedule; the host
then calls:

```typescript
machine.poll( now )   // -> how many procedures fired
```

The host owns the clock and the cadence — `machine.poll( millis() )` from an Arduino
`loop()`, a `setInterval` in Node. Three rules matter:

- **Scheduling starts at the first poll.** At export time the machine has no clock, so a
  procedure's first deadline is set the first time the host supplies a `now`.
- **One fire per poll, per procedure — no catch-up.** If a poll arrives long after the
  interval elapsed, the procedure fires *once* and the next deadline is rebased on `now`.
  A host that polls every 10s with `S100` gets one fire per poll, not a hundred.
- **Bodies are bounded.** A fired body goes through the same queue as `T11`, capped by
  the work budget below, so runaway recursion fails with `QueueOverflow` rather than
  spinning.

### The recursion guard

A procedure may run itself (`T11` inside its own body, directly or through a cycle), so
both engines bound it — and bound it *identically*:

- **`maxQueue` (default 1024) is a budget of machine-enqueued work per host drive**, not a
  queue depth. Depth is useless here: both engines splice a body in at the *front* to keep
  nested calls ordered, so during recursion the queue stays about two items deep no matter
  how long it runs.
- **Only work the machine enqueued counts.** Lines the host feeds are exempt, so where the
  budget trips does not shift with the size of the program that triggered it. This is what
  makes the two engines agree: C++ feeds host input straight to `parse()` and never sees it
  in the queue either.
- On exhaustion the queued work is dropped and `QueueOverflow` (`F2`) is emitted. The
  machine stays responsive.
- **The defaults are live.** The guards read `if ( limits.maxQueue && … )`, so an absent
  limit disables them — TS therefore ships real defaults matching the generated C++ ones
  rather than an empty object.

Given the same `maxQueue`, both engines produce byte-identical output for a self-running
procedure, asserted in `ts-test/gggtxFlow.test.ts` and cxx `test_flow_procedures`.

This is what makes the language Turing complete — an unbounded export that reads and
writes registers and conditionally re-exports itself is a Turing machine — while keeping
the halting decision outside the language. A runaway program consumes host ticks, and the
host can simply stop granting them.

Because time is a parameter rather than something the machine reads, async behaviour is
deterministic and conformance-testable: a case declares `polls: [ 0, 200, 500 ]` and both
engines replay the same clock.

The `ggg` CLI is one such host and polls for you (`--tick <ms>`, default 10), so exported
procedures just run:

```bash
ggg -a blink.ggg      # T12 R"blink" S200 G5 -> five runs over ~1s, then exits
```

Its ticker also decides when the process ends: polling continues while anything is
scheduled and stops once input has ended and the schedule is empty. A script with a
bounded export finishes its runs and exits; an unbounded one keeps going until you stop
it, which is the host-owns-halting property made concrete.

## Subsystems and the C++ port

The core (`ts/ggg/`) is data + dispatch only; behaviour is supplied as command sets loaded
by subsystem: `ggggx` (graphics/matrix), `gggpx` (print), `gggtx` (flow). A case declares
which it `needs`; `gggdx` adds machine-readable protocol self-description.
The conformance harness loads exactly that union
([conformance.ts](https://github.com/koopero/GGGCode/blob/main/ts/cxx/conformance.ts)).

The C++ port (`cxx/`) mirrors the TypeScript reference. Shared enums, operator tables, and
storage descriptors are **generated** from the TS source of truth (`buildCxxDefs`), and the
conformance corpus (`cases/*.yaml`) is compiled into a C++ test table (`buildConformance`).
The two engines agree on each case's decoded `values` within a global epsilon; byte-exact
output is asserted only where a case opts in. This is why behaviour documented in
[cases.md](cases.md) holds for both engines.

See the [protocol guide](protocol.md) for the interface between command metadata
and gggdx, and the [C++ guide](cxx.md) for a compiling runtime example and all
feature gates.

### C++ numeric backends

The C++ runtime defaults to `ggg::FixedTraits`: language and register values are signed
Q16.16 (`int32_t`, step `1/65536`, range approximately `-32768..32768`). Parsing,
formatting, arithmetic, constants, range solving, and matrix sampling all stay in integer
code. The sampler uses the same `ScaledNumber` primitive with a higher-precision internal
coordinate scale; “normalized” and “fixed” are therefore formats of one primitive rather
than separate numeric systems.

Code that genuinely needs IEEE range or math operators absent from the fixed profile can
opt into `ggg::FloatTraits` or `ggg::DoubleTraits`, either as a template argument or for
the whole build:

```cpp
ggg::MachineT<ggg::FloatTraits> machine;
// or: -DGGG_DEFAULT_TRAITS=::ggg::FloatTraits
```

The fixed type deliberately has no floating-point constructor or conversion, so an
accidental float seam fails to compile instead of quietly pulling floating-point helpers
into embedded firmware. Its `sin`, `cos`, `atan`, and `atan2` matrix operators use a
24-step integer CORDIC kernel with 30 fractional working bits. Fixed matrix operators not
yet connected to an integer kernel (the remaining trigonometric and hyperbolic functions,
logarithmic, exponential, and power operators) report the existing `BadOperator` failure.

Conformance cases that require IEEE range or semantics declare `requiresFloat: true` in
their `cases/*.yaml` record. Float and double backends still run those cases; the fixed
backend skips only that explicit set.
