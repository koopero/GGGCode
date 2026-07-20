# Flow Control and Function Definitions Plan

## Goal

Add flow control without making the parser a programming language. GGGCode stays line-oriented: every line is still a command. Flow control lives at the machine boundary, where a stack frame can inspect each command as soon as it is formalized and decide whether the rest of that line should run, be captured as source, or be skipped.

This keeps the language small while giving extensions enough authority to implement blocks, procedures, conditionals, loops, and later macros. The machine supplies the control gate; the `T` extension supplies the meaning.

## Core Runtime Contract

Introduce a narrow machine runtime interface in TypeScript and a matching explicit control surface in C++.

In TypeScript, replace `HookArgs.machine?: any` with a real command-facing interface, tentatively `MachineRuntime`. It should expose only operations commands are allowed to use:

- `output()` and `outputOk()`
- register lookup and creation
- `solve()`
- `pushFrame()` and `popFrame()`
- `enqueueLines()` or `enqueueTokens()`
- a way for a stack hook to return a command decision

Do not add procedure-specific methods to the machine. No `defineProcedure()` or `getProcedure()` belongs in core. Procedures are `T` registers. Do not expose `queue`, `queuePointer`, `stack`, or parser internals directly. Flow commands need power, but the machine must keep its own invariants.

Use a small decision enum:

```ts
type CommandDecision = "run" | "capture" | "skip" | "error"
```

`run` means normal dispatch continues. `capture` means the line is consumed and saved as source. `skip` means the line is consumed and discarded. `error` emits failure output and consumes the line.

## Command Formalization Gate

The key hook point is not "before line" but "after command formalization." A command is formalized when the parser has read enough to know the command name: the initial code letter plus its numeric suffix.

In TypeScript this can still happen over a parsed `Token`, but the semantic model should match the streaming machine:

```ts
type CommandGateArgs = {
  machine: MachineRuntime
  command: string
  sourcePrefix?: string
  state: Record<string, unknown>
}
```

The top stack frame runs before normal command dispatch. If it returns `run`, command hooks proceed value by value. If it returns `capture` or `skip`, the parser consumes the rest of the line without dispatching command hooks.

C++ should mirror this directly. Add a `CommandView` or similar lightweight value containing at least:

- command name
- raw source prefix read so far
- command code and number, if useful

Then add `beforeCommand(CommandView&) -> CommandDecision` on the active frame.

## Saving Code

Procedure definitions save source lines into `T`-owned registers as the primary representation.

TypeScript may also cache parsed `Token[]` for speed, but raw source should remain authoritative because it preserves comments, formatting, and C++ parity. C++ should store `std::vector<String>` procedure bodies.

The machine does not know what a procedure is. It only knows that a `T10` command pushed a capture frame, and that the frame decided to capture or skip later lines. The captured body is committed by the `T` extension into a register such as:

```ts
type ProcedureRegister = {
  name: string
  index: number
  lines: string[]
}
```

Example intended behavior:

```ggg
T10 L"blink"
G20 R0 P0 VK
G20 R0 P0 VZ
T1

T11 L"blink"
```

`T10` resolves or creates a procedure register, starts capture, and pushes a procedure-capture frame. Every following command is inspected at formalization time. Non-terminator lines are consumed and appended to the frame body as source. The matching `T1` is consumed but not saved. At block close, `T` stores the body into the procedure register. `T11` resolves the register and enqueues its saved lines after the current command.

## Commands

Reuse the existing `gggtx` direction, but make it real and shared:

- `T1`: end block
- `T9`: universal flow-control block
- `T10 L"name"`: define procedure
- `T11 L"name"`: run procedure

The exact command numbers can change, but they should be generated or documented in one place so TS and C++ cannot drift.

`T9` should be the general block combinator:

- `A`: execute if all solved values are truthy
- `O`: execute if any solved value is truthy
- `G`: repeat mode; upgrades `A` or `O` from if to while
- `V`: execute once for each solved value
- `R`: write current flow state to a register

This avoids separate `IF`, `WHILE`, and `FOR` commands. Ranges, lists, references, and multi-axis values already exist; `T9` composes them.

Example:

```ggg
T9 V0:10 R"it"
G20 R0 P$it V1
T1
```

The flow state register is owned by the `T` extension. At minimum it should expose the current value, iteration index, pass/fail state, and done state.

## Offset References

Matrix awareness should live in reference solving, not in `T9`.

Current references read values:

```ggg
$frame[0:|0:]
```

Add an explicit offset-returning reference form, tentatively:

```ggg
$frame@[0:|0:]
```

This resolves the subscript against `frame` dimensions and yields flat offsets instead of matrix values. Existing `$frame[...]` keeps value-read semantics.

Conceptual TypeScript shape:

```ts
type Reference = {
  register: string
  subscript: Numeric[]
  mode?: "value" | "offset"
}
```

With this, `T9` stays generic:

```ggg
T9 V$frame@[0:|0:] R"it"
G20 R1 P$it V1
T1
```

The loop iterates matrix addresses, but `T9` only sees solved values. The matrix dimension logic belongs to `Solve(reference)`.

Do not overload plain `$frame[...]`; the distinction should remain visible in source. `$x[...]` reads stored values. `$x@[...]` reads addresses.

## TypeScript Implementation

1. Define `MachineRuntime`, `CommandDecision`, and stack frame types in `Language.ts` or a small new runtime module.
2. Update `HookArgs.machine` from `any` to `MachineRuntime`.
3. Add machine methods:
   - `pushFrame(frame)`
   - `popFrame()`
   - `enqueueLines(lines, mode)`
4. Update `execLine()` around the command gate:
   - ask the top frame for a decision once the command is known
   - dispatch normally only on `run`
   - save or discard the line on `capture` or `skip`
5. Implement `gggtx` around this API instead of calling missing methods like `addQueueReference`, `jumpQueue`, and `setSkip`.
6. Add a `ProcedureRegister` or `TRegister` type and store bodies through the existing register mechanism, keyed by that class/type.
7. Add tests:
   - defining a procedure does not execute its body
   - running a procedure executes its body in order
   - nested block capture preserves inner blocks
   - unknown procedure returns `O0`
   - recursion depth or queue growth is bounded
   - `T9 A` and `T9 O` true and false paths
   - `T9 V` iterates solved ranges, preserving inclusive range semantics
   - offset references return flat matrix offsets

## C++ Implementation

C++ should not pre-buffer a whole line to make a flow-control decision. That loses the best property of the current machine: it can parse and dispatch value by value.

Instead, add a command-formalization gate inside `loadCommand()`:

1. `input(Char)` appends the character to a current-line source recorder.
2. The existing parser runs normally until `loadCommand()` has built the command name.
3. Before assigning `command` or calling `hookCommand()`, ask the active control frame for a decision.
4. On `run`, proceed exactly as today: command hooks receive values as they parse.
5. On `capture`, suppress command hooks for the rest of the line and commit the recorded source at newline.
6. On `skip`, suppress command hooks for the rest of the line and discard the recorded source at newline.

This gives flow control a true pre-dispatch point without requiring the machine to look past the formalized command.

Add C++ support types:

- `enum class CommandDecision { Run, Capture, Skip, Error };`
- `struct CommandView { String command; Char code; NumberType number; String sourcePrefix; };`
- a control-frame base type with `beforeCommand(Machine&, const CommandView&)`
- a `T` register type, owned by the `T` extension, containing `std::vector<String>` source lines

The parser needs one new suppression mode: "consume the rest of this line without dispatching command hooks." Source recording happens independently of parser mode, so captured lines can preserve their original text even when values are not parsed.

Implement C++ `T10`, `T11`, `T1`, and simple conditionals after the command gate is in place. `T10` writes procedure bodies to `T` registers; `T11` reads those registers and enqueues their source lines. Keep procedure bodies as source strings for compactness and parity.

## Parity and Conformance

Add a small shared flow-control conformance corpus once TS and C++ both support the same commands. Good first cases:

- define and run one procedure
- procedure with two matrix writes
- `T9 A0` consumes its body
- `T9 A1` runs its body
- `T9 V0:3` runs its body four times
- nested procedure or nested conditional capture
- offset reference over a small matrix returns expected flat offsets

Avoid adding complex loops to conformance until recursion and queue limits are settled.

## Resolved Decisions

- Procedure capture preserves source for formalized command lines, excluding comments.
- Blank lines, inline comments, and comment-only lines are not captured.
- `T` registers are addressable by both `R` index and `L` name through the shared register access routines.
- Redefining a procedure overwrites the previous body silently.
- Recursion and queued-line growth must be bounded by effective machine limits.
- Loop conditions are expressions.
- Offset references use `@`: `$m@[...]`.
- Flow-control commands live in `gggtx`.
- Procedure lifetime follows register lifetime; there is no separate machine-level procedure store.

## Outstanding Questions

- What exact numeric defaults should recursion and queued-line limits use in TS and C++?
- Should offset references eventually expose coordinate tuples too, or only flat offsets?

## Main Concern

The risky part is not TypeScript. TypeScript already has whole parsed lines. The risky part is C++, where parser and executor are intentionally fused.

Do not solve that with line buffering. Solve it by making `loadCommand()` a formal command gate. After that, procedures, conditionals, and simple loops become ordinary machine features instead of parser features, while the C++ machine keeps its value-by-value streaming character.
