# Design: Cooperative Multitasking in the C++ Runtime

**Status:** in progress. **Stage 1** (budgeted queue draining) and **Stage 2**
(input ring + unified `step()`) are implemented and covered by the cxx tests;
Stages 3–4 remain proposals.
**Scope:** `cxx/` only. The TypeScript reference is unaffected; it remains the
behavioural source of truth and the conformance partner (see
[runtime.md](runtime.md)).

## Motivation

The C++ runtime is meant to run on microcontrollers. There it shares one CPU
with everything else the device must do: service interrupts, feed the watchdog,
drive other transports, run an RTOS task that must stay short. The problem is
that today the runtime executes **run-to-completion**: once the host hands it
work, it does not return until that work is finished. A long range sweep
(`P10 V1:1000000`), a large blit, a self-running exported procedure, or a `D1`
catalog dump holds the CPU for its entire duration. On embedded that is the
difference between a responsive device and one that trips its watchdog.

The goal of this refactor is to make execution **resumable and budgeted**: the
host grants the runtime a bounded slice of work, the runtime does that much and
returns, and the host comes back later to continue. No preemption, no threads
required — cooperative yielding at well-defined points, in the stackless,
explicit-state style the parser is already written in.

## What the architecture already gives us

The runtime is further along than it looks. Three existing properties are the
foundation this design builds on, rather than replaces:

1. **Parse state is already externalized.** [`MachineStateT`](../cxx/include/Machine.h)
   is a plain struct — modes, buffers, the UTF-8 accumulator, the `$name[...]`
   subscript cursor. The lexer in `parse(char)` is already a resumable state
   machine: you can feed one byte, return, and feed the next byte later with no
   loss. The *front half* of execution is already cooperative.

2. **The host already owns the clock and the halting decision.** `T12` only
   *schedules*; the host drives [`poll(now)`](../cxx/include/Machine.h). Time is
   a parameter, not something the machine reads. The cooperative contract — the
   host decides when to grant ticks — is already the design.

3. **Value expansion is already a lazy pull iterator.**
   [`CompoundExpansionT<T>`](../cxx/include/Solve.h) yields one value at a time
   through `bool next(Number&)` with O(axes) state, and it is a copyable value
   type. It can be *parked* in machine state and resumed with no redesign.

So the gap is narrow and specific: the places that **loop to completion** rather
than returning control. This design names those places and makes each one
budget-aware.

## The run-to-completion hotspots

| # | Site | Problem |
| --- | --- | --- |
| H1 | [`drainPending()`](../cxx/include/Machine.h) | `while(!pending.empty())` — a queued body runs fully before returning. |
| H2 | [`poll()`](../cxx/include/Machine.h) | Fires every due procedure and drains each fully, inside one call. |
| H3 | [`emitCompound()`](../cxx/include/Machine.h) | `while(expansion.next(v)) dataAppend(v)` — a whole sweep in one line. |
| H4 | command hooks (blit, matrix read, `D1`) | O(n) work with no internal yield point. |
| H5 | [`write()`](../cxx/include/Machine.h) | Assumed synchronous and infallible; blocks on a full TX FIFO. |
| H6 | [`interrupted`](../cxx/include/Machine.h) | Abort-only, checked only in the outer feed loops; discards work rather than parking it. |

## Goals, non-goals, invariants

**Goals**

- A single host-facing entry point that advances execution by a bounded amount
  and reports whether more work remains.
- Bounded worst-case execution time (WCET) per host call, so the host can
  guarantee it services ISRs and the watchdog on schedule.
- Resumption across all six hotspots without buffering whole result streams.
- A clean split between *yield* (pause, keep state, resume) and *kill* (abort,
  drop state).

**Non-goals**

- Preemption, threads, or per-task stacks. This is cooperative and stackless.
- Changing the language. No new commands, no new grammar. `T12` + host polling
  remains the repetition model.
- Changing the TypeScript engine. TS stays batch/queue-driven.

**Invariants (these are the acceptance criteria)**

- **I1 — infinite budget is identical to today.** `run()` and `poll()` with an
  unbounded budget must produce byte-identical output to the current
  implementation. All existing conformance passes unchanged.
- **I2 — budget granularity is invisible.** The same program fed under *any*
  budget — including one work unit at a time — produces byte-identical output to
  the infinite-budget run. This is the correctness proof for every
  save/restore. It becomes a conformance mode (see
  [Conformance strategy](#conformance-strategy)).
- **I3 — the enqueue budget is untouched.** `maxQueue` as described in
  [runtime.md](runtime.md#the-recursion-guard) is a budget of *machine-enqueued
  work per host drive* and keeps the two engines in agreement. The new *time/op*
  budget is a separate currency layered on top; it must not change where
  `maxQueue` trips.

## Concrete interfaces

### `StepStatus`

What one unit of host-driven advancement reports back. A small enum, hand-written
in both engines if it ever reaches TS (it is behavioural, like `CommandDecision`).

```cpp
namespace ggg {
  enum class StepStatus {
    Idle,      // nothing to do: no input buffered, no queue, no timer due
    Yielded,   // budget exhausted mid-work; call step() again to continue
    Blocked,   // cannot progress until an external condition clears
               //   (output sink full, or input needed but none buffered)
    Done,      // the unit of work the host asked about completed cleanly
  };
}
```

`Blocked` is distinct from `Yielded` on purpose: `Yielded` means "I have more to
do, come straight back"; `Blocked` means "do not bother coming back until the
sink drains / more input arrives." A host can spin on `Yielded` but should wait
on `Blocked`.

### `StepBudget`

The currency the host grants. Two independent limits; whichever trips first ends
the slice. Either may be left zero to mean "unbounded on that axis," so
`StepBudget{}` reproduces today's run-to-completion (used by the compatibility
wrappers for **I1**).

```cpp
namespace ggg {
  struct StepBudget {
    // Max "work units" to spend this slice. The unit is the same currency as
    // limits.maxOperations: one unit per value emitted, per scalar blitted,
    // per command dispatched, per line de-queued. 0 == unbounded.
    Index operations = 0;

    // Optional wall-clock deadline. When nonzero, step() stops once
    // now() >= deadline, checked only at yield points (never mid-scalar). The
    // host supplies now() via the same clock it already feeds poll(). 0 == no
    // deadline.
    unsigned long deadline = 0;
  };
}
```

Charging per *scalar* (not per line or per command) is what bounds WCET for the
H3/H4 hotspots: a million-element sweep cannot consume more than `operations`
units before yielding, regardless of how it was written.

### `step()` — the unified driver

Today there are three drivers (`run`, `poll`, `drainPending`). This collapses
them into one scheduler the host calls from its superloop.

```cpp
// Advance execution by at most `budget`. Services, in priority order:
//   1. the pending work queue (procedure/loop bodies)   <- queue before input,
//      so a body runs before the next host line         so ordering is preserved
//   2. buffered host input bytes (REPL / transport), one line per unit
// Returns Yielded when the budget is spent with work left, Idle when done.
StepStatus step( unsigned long now, const StepBudget &budget = {} );

// Convenience overload for hosts without a clock axis.
StepStatus step( const StepBudget &budget = {} ) { return step( 0, budget ); }
```

**As implemented, `step()` services the queue and host input; timers stay in
`poll()`** (see the Stage 2 note below). Phases 3–4 of the original sketch — a
timer phase and a parked continuation — arrive with the resumable executor in
Stage 3, where a fired body can itself yield mid-flight.

Input stops being pushed synchronously through `parse()`. Instead the host
*offers* bytes into a ring buffer, and `step()` pulls them under budget:

```cpp
// A byte arriving on UART/socket is just an enqueue. Returns the number of bytes
// accepted. The ring is unbounded for now, so it always accepts everything; a
// bounded ring that returns a short count under backpressure is a later stage.
Index offer( const char *bytes, Index count );
Index offer( const String &s );
Index offer( Char byte );
```

The existing `run()`/`input()`/`poll()` become thin compatibility wrappers that
preserve **I1**:

```cpp
void run( String code ) {               // unchanged behaviour
  offer( code.data(), (Index) code.size() );
  step( /*now*/ 0, StepBudget{} );      // unbounded: drains to completion
}

Index poll( unsigned long now ) {       // unchanged behaviour
  StepStatus s = step( now, StepBudget{} );
  return /* procedures fired this call, as today */;
}
```

### The continuation: a parked unit of work

This is the heart of value-level and I/O-level cooperation (H3, H4, H5). When a
command cannot finish within the budget, it parks a **continuation** on the
machine and returns; `step()` resumes it before pulling anything new.

A continuation is deliberately *not* a saved call stack. It is a small, explicit
record of "where a streaming command was," in the same spirit as the parser's
externalized state. The expansion iterator is already a value type, so parking
it is a move, not a redesign.

```cpp
namespace ggg {
  template <class T = DefaultTraits>
  struct Continuation {
    // The command whose streaming hook is mid-flight. Its hookNumber() is
    // re-driven with each resumed value exactly as if parsing had produced it.
    CommandTypeT<T> *command = nullptr;
    Char code = '\0';                    // the arg code the values belong to

    // A parked value source. Exactly one is active:
    //   - expansion: a half-consumed range/multi-axis sweep (H3)
    //   - reference: a half-read register (resolveReference walked to `cursor`)
    CompoundExpansionT<T> expansion;
    bool hasExpansion = false;

    MatrixBaseT<T> *refReg = nullptr;    // register being streamed by $name
    Index refCursor = 0;                 // next flat scalar to read
    Index refEnd = 0;

    // A command that produces (rather than consumes) a long stream — a matrix
    // read, a D1 catalog — parks its own cursor the same way, via a virtual
    // resume hook on the command (see below). This holds its opaque position.
    Index produceCursor = 0;

    bool active() const { return command != nullptr; }
    void clear() { command = nullptr; hasExpansion = false; refReg = nullptr; }
  };
}
```

Two cooperation shapes fall out of this:

- **Value-consuming commands** (`P10 V1:N`, a blit fed by a sweep). The parked
  `CompoundExpansionT` is pulled by `step()` under budget; each value is handed
  to the command's existing `hookNumber()`. No command code changes — only
  `emitCompound()` learns to park instead of looping (see Stage 3).

- **Value-producing commands** (matrix read, `D1`). These gain one optional
  hook so they can yield mid-output:

```cpp
// Added to CommandTypeT<T>. Default: no streaming production, so existing
// commands are unaffected (I1). A command that can emit a long stream
// implements it, writing at most `budget` units and returning Done when
// finished, Yielded when it parked `produceCursor` for next time, or Blocked
// when write() reported the sink is full (H5).
virtual StepStatus hookProduce( Continuation<T> &, const StepBudget & ) {
  return StepStatus::Done;
}
```

### Output backpressure

`write()` grows a return value so a producing command can tell the sink is full
and park (H5). Default behaviour (always accepts) keeps existing `write()`
overrides working under **I1** — the base class simply reports everything
written.

```cpp
// Returns bytes accepted. Fewer than str.size() means the sink is full; the
// caller parks and retries the remainder on the next step(). The default
// implementation writes everything and returns str.size(), so a host that
// never blocks behaves exactly as today.
virtual Index write( const String &str );
```

### Yield vs. kill

[`interrupted`](../cxx/include/Machine.h) is split into two distinct concepts:

```cpp
// Cooperative: checked at yield points. When it returns true, step() parks and
// returns Yielded. Lets the host end a slice on a condition the StepBudget
// cannot express (a higher-priority event just landed). Optional; nullptr means
// "budget only."
std::function<bool()> shouldYield;   // or a plain function-pointer on MCU

// Destructive: abort the current task. Clears pending, the continuation, and
// frames, resets the parse state to line start, and returns to Idle. This is
// the existing interrupt() semantics, kept — but no longer the only option.
void kill();
```

## The per-task Context (optional, Stage 4)

Everything above gives one machine a *responsive* single stream. True
*multitasking* — several concurrent clients, e.g. two transports, or a live REPL
interleaved with background async procedures — needs the mutable per-stream state
separated from the shared long-lived state.

```cpp
template <class T = DefaultTraits>
struct TaskContext {
  MachineStateT<T> state;              // parse state (already a struct)
  std::vector<ControlFrameT<T>*> frames;
  std::vector<PendingItem> pending;
  Continuation<T> cont;                // this task's parked work
  Int requestId = 1;
  RingBuffer input;                    // this task's byte source
};
```

The `MachineT` keeps the **shared** surface — `commands`, `registers`,
`procedures`, `schedule`, `limits`, the output sink — and owns a small set of
`TaskContext`s that `step()` round-robins under a per-task slice cap.

**Design note to settle before building this:** `registers` is shared mutable
state. Two tasks writing the same buffer is a data hazard. The honest model is
"tasks share one address space, like threads" — document it, and keep register
*structural* mutations (create/resize) single-threaded by running them only at
task boundaries, never mid-slice. If that is unacceptable, registers must become
per-context, which is a much larger change. Stages 1–3 do **not** require this
decision; defer it until a concrete multi-stream requirement exists.

## Staged plan

Each stage is independently shippable, independently testable, and preserves
**I1/I2** on its own.

### Stage 1 — Budgeted queue draining

*Unlocks line-granularity cooperation. Smallest blast radius.*

- Add `StepStatus` and `StepBudget`.
- Thread the budget through `drainPending(budget)` so it dequeues at most
  `operations` lines (and checks `deadline`) then returns `Yielded`, leaving the
  rest in `pending` (H1).
- `poll()` stops draining inside itself: it only enqueues due bodies; the queue
  is drained by `step()` (H2).
- `run()`/`poll()` become infinite-budget wrappers (I1).
- No continuation yet; a single *line* still runs to completion. That is
  acceptable — lines are short and bounded.

**Test:** existing conformance unchanged, plus a "drip" harness that drives each
flow case one line of budget at a time and asserts byte-identical output (I2 at
line granularity).

### Stage 2 — Input ring + unified `step()`

*The superloop kernel.* **Implemented.**

- Added the input ring and `offer()`; host bytes are buffered and pulled by
  `step()` rather than pushed straight through `parse()`.
- `step(now, budget)` drains the queue then parses host input, one work unit
  (one queued item **or** one host line) per loop iteration, yielding when the
  budget is spent. `finishLine()` no longer drains — the driver owns draining,
  so a line's enqueued body runs before the next host line, under budget.
- `run()`/`input()`/`runOneLine()` became `offer()` + unbounded `step()`;
  behaviour is unchanged for every existing caller, including the char-at-a-time
  `input(Char)` path.

**Scope decision:** timers stay in `poll()` for now. A standalone `poll(now)`
call must drain to completion, and folding the "one fire per drive, no catch-up"
timer semantics into a budgeted `step()` is entangled with making a *fired body*
itself yield — which is Stage 3 work. So `step()` covers input + queue; the host
still calls `poll(millis())` for the clock, exactly as [runtime.md](runtime.md)
describes.

**Tests:** `test_cooperative_step` covers incremental `offer()` across chunks, a
held partial line, the queue-before-input ordering hazard under a one-unit
budget, and that `step({1})` advances exactly one unit and reports `Yielded`. The
drip tests (`test_conformance_drip`, and the self-running-overflow case) now
drive every conformance case one unit at a time through `step()` and assert
byte-identical output to the unbudgeted run.

**Still open:** a true per-call WCET *measurement* on the ESP32 reference build
(a slice-time row in [cxx.md](cxx.md#esp32-reference-size)) needs hardware and is
not done here; the work-unit accounting that makes such a bound meaningful is in
place.

### Stage 3 — Continuations: value and I/O cooperation

*Value-granularity cooperation and backpressure.*

- Add `Continuation<T>` to the machine.
- `emitCompound()` parks the `CompoundExpansionT` instead of looping; `step()`
  pulls it under budget into the command's `hookNumber()` (H3).
- `resolveReference()` parks `refReg`/`refCursor` the same way.
- `write()` gains its return value; add `hookProduce()`; convert the large
  producers (matrix read, `D1`) to stream under budget and honor backpressure
  (H4, H5).
- Split `interrupted` into `shouldYield` + `kill()` (H6).

**Test:** I2 at *value* granularity — drive `P10 V1:10000` at `operations = 1`
and assert identical bytes to the unbounded run; a mock sink that accepts N
bytes per step and asserts a `D1` dump reassembles identically under
backpressure.

### Stage 4 — Per-task Context

*Only if multi-stream concurrency becomes a real requirement.* Settle the shared
-registers question first (above). Factor `TaskContext`, round-robin in `step()`.

## Conformance strategy

The existing corpus (`cases/*.yaml`, compiled to a C++ table — see
[cases.md](cases.md)) is the safety net. Two additions:

- **Budget sweep (proves I2).** Re-run every existing case under a set of
  budgets — `{∞, 1 line, 1 op}` — and assert byte-identical output across all of
  them. Any divergence is a save/restore bug in a continuation. This is cheap
  (same cases, different driver) and is the single most valuable test this design
  introduces.
- **Backpressure replay.** For cases that opt into byte-exact output, re-run with
  a sink that accepts a fixed small quantum per step and assert the reassembled
  stream is identical. Proves H5 parking is lossless.

Because TS stays batch-driven, these modes are **C++-only** and live beside the
existing cxx flow tests, not in the cross-engine assertions. The cross-engine
contract is still "same decoded values within epsilon, byte-exact where opted
in," unchanged.

## Open questions

1. **Budget unit calibration.** Is one unit per emitted value the right grain, or
   should a blit scalar cost differently from a formatted print value? Needs WCET
   measurement on real silicon (Stage 2 deliverable) before fixing the currency.
2. **`shouldYield` on MCU.** `std::function` allocates; a plain function pointer
   or a virtual `bool shouldYield()` is cheaper. Decide during Stage 3 alongside
   the existing float-seam discipline in [cxx.md](cxx.md#numeric-traits).
3. **Fairness policy.** Round-robin vs. priority (foreground REPL over background
   timers). Start round-robin; revisit only with a concrete workload.
4. **Shared registers under Stage 4.** The threads-share-address-space model vs.
   per-context registers — deferred, but it is the one decision that could
   enlarge the whole effort, so flag it early.
