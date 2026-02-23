# GGGCode — A Language Review

GGGCode describes itself as a "minimal meta-language inspired by G-Code." That framing is accurate and also the right starting point for any critique: the design choices that make it interesting are inseparable from the choices that make it strange.

---

## What It Is

At its core, GGGCode is a line-oriented, argument-coded, data-dense command language. Every line is a command; every piece of data on that line is prefixed by a single uppercase letter that names it. The syntax is borrowed faithfully from CNC G-Code:

```
G0 X10 Y20 Z5   ; move
M104 S200        ; set temperature
```

The key extension over vanilla G-Code is a richer value language. Where G-Code allows only decimal numbers, GGGCode adds ranges, multi-axis values, hex encodings, normalized hex, named constants, string literals, and references to named Matrix registers. This is the interesting part.

---

## What Works Well

**The numeric encoding system is genuinely good.** The hex format family — `0X`, `0H`, `0J`, `0G`, `0I` — covers a spectrum from raw integers to normalized fixed-point values in a compact, parseable way. `0H8040FF` as a list of three 8-bit normalized floats (0.5, 0.25, 1.0) is remarkably dense for text. The selection logic in `EncodingShortest` lets the serializer choose the most compact representation automatically. For a language whose primary domain seems to be pixel and matrix data, this is well-considered.

**Ranges are expressive.** The `1:10`, `1>10`, `1:10/4`, and open-range `0:/4` notations compress what would otherwise be verbose loops into single value expressions. Combined with `|` for multi-axis and `,` for lists, a single argument can describe a complete traversal pattern. The fact that `Solve` expands these lazily as a generator is the right implementation choice — nothing is materialized until a command hook reads it.

**The hook model is clean.** `Command` → `Code` → `Value` → `EndArg` → `End` provides precise injection points at every level of parsing. A command implementation can handle values one at a time (`hookValue`), inspect the argument structure (`hookCode`, `hookEndArg`), or do setup and teardown (`hookCommand`, `hookEnd`). This is more useful than a single callback that receives a finished argument structure, because it lets commands stream-process data without buffering.

**Matrix is a first-class citizen.** Having a multidimensional typed array as a built-in register type, with coordinate-based access, image interop, and round-trip serialization to GGGCode, makes the language viable for graphics and signal-processing pipelines without needing an external data model.

**The streaming parser is thoughtful.** A character-by-character state machine alongside the batch `ParseLines` means the same language can serve both interactive REPL-style use and batch file processing. The async design of the `StreamParser` callbacks means it can yield to I/O between lines without blocking.

**Unitary constants are a nice touch.** `K` (1), `Z` (0), `N` (−1), `π`, `τ`, `φ`, `γ` as single tokens is compact and readable for mathematical programs. The Unicode constants in particular (`π`, `τ`, `e`, `φ`, `γ`) show ambition toward legibility.

---

## What Is Harder

**The command naming convention is borrowed, not designed.** G-Code names like `G0` and `M104` carry meaning in CNC because the numbers are standardized. In a general-purpose meta-language, `G0` is arbitrary. The convention that the first argument's code letter and its numeric value together form the command name (so `G0` is parsed as letter `G` + code `0`) is clever but not obvious, and it means the command namespace is flat and unstructured. There is no hierarchy, no namespacing, no grouping beyond the convention table in `CommandConvention`.

**Line orientation is limiting.** One command per line is the right model for machine control but restricts expression for general use. Complex data initialization requires many sequential lines. There is no grouping construct, no block, no subroutine call syntax — composition happens entirely through the queue and stack mechanisms in `Machine`, which are invisible in the source text.

**There is no control flow.** Ranges and multi-axis values substitute for iteration over data, but there is no conditional, no loop, no branching. A program that needs to do different things based on computed values must implement that logic in command hooks (i.e., in the host language, TypeScript), not in GGGCode itself. This is a deliberate design boundary — GGGCode is a command protocol, not a general-purpose language — but it is worth naming clearly.

**The `Solve` interface has a hidden asymmetry.** `RangeAxis` expands to a flat stream of scalars. `RangeAxes` expands to coordinate tuples. These are different shapes, and a command hook receiving values through `hookValue` gets scalars either way — the axis structure is consumed by the time values arrive. The multi-axis semantics are only recoverable if the command examines the raw `Token` argument rather than the solved values. This makes `|` semantics somewhat opaque to command implementors.

**Global mutable state is a design smell.** `Machine.state` is a plain dictionary shared across all commands and all executions. Per-command state (`commandState`) is slightly better, but both are effectively globals. For single-threaded batch processing this is fine; for concurrent or re-entrant use it would be a problem.

**The `Reference` subscript allows `Numeric` values — including ranges.** A subscript can contain a range, which means a reference can denote multiple elements. It is not clear whether this is uniformly supported or whether it works only when the consuming command explicitly handles generator values in subscript position. The power is there but the contract is implicit.

---

## The Type Naming Question

The TypeScript API uses a `ggg`-prefix convention throughout (`gggPrimitive`, `gggCommand`, `gggHooks`, `ggggxVecArg`). This is defensive namespace hygiene — reasonable for a library — but verbose in practice. The fact that the glossary linter immediately renamed these to `Primitive`, `Command`, `Hooks`, `VecArg` suggests the prefix is felt as noise. A module-level namespace or simply relying on import paths would be lighter.

---

## Overall

GGGCode occupies an interesting position: it has the syntax of a machine protocol but the ambitions of a data language. The range system and encoding formats are sophisticated enough to express image and matrix data compactly. The hook model is a good foundation for extensible command semantics. The streaming parser and async execution model are appropriate for real-time use.

Its limits are the natural limits of its lineage. A line-oriented, stateless-syntax language without control flow is genuinely minimal, and that minimalism is a feature in the contexts it is designed for — CNC-adjacent machine control, streaming data processing, configuration with embedded data. For anything requiring conditional logic or structured composition, the GGGCode layer hands off to the host language, and that boundary seems intentional rather than accidental.

The language is most compelling when used for what its encodings and Matrix system are optimized for: compact, dense, round-trippable representation of numerical data with command semantics layered on top. That is a narrow but real niche, and within it GGGCode is well-designed.

---

## GGGCode as a Live Code Glitch Language

Live coding is performance: a programmer writes or mutates code in real time while the output — sound, image, video — is the show. Glitch is aesthetic: the embrace of corruption, quantization error, buffer overflow, and broken state as expressive material rather than failure to be corrected. Together they demand a language that is terse, forgiving, visually or sonically immediate, and — crucially — interesting to look at while being typed.

GGGCode is not designed for this. It is also surprisingly well-suited to it.

### The Notation Is Already Glitch

Consider what GGGCode source looks like in practice:

```
W0 R0 D3,640,480 T8
W0 V0H000000FF00FF
W0 V$frame[0:640|0:480] E0Hff0000
```

This is not code that looks like code. It looks like a memory dump, a corrupted MIDI stream, a transmission from a machine that has partially forgotten what it is. The hex encoding formats are especially striking: `0H8040FF`, `0I5A3B`, `0Gff0088` read like addresses, like register contents, like the raw bytes you see in a hex editor before you understand them. A performer typing this live is visually indistinguishable from someone doing something dangerous and technical, which is exactly the aesthetic.

The unitary constants reinforce this. `K`, `Z`, `N`, `π`, `τ`, `φ`, `γ` scattered among hex runs and range operators produce a text that is neither readable prose nor recognizable math — it is its own visual register, somewhere between APL and corrupted G-Code tape.

### Built-In Quantization

Glitch art is frequently about quantization — the violent discretization of continuous signal into stepped artifacts. GGGCode has this baked in. `HexNorm1` has exactly 4 bits of precision: 16 steps between 0 and 1. Apply it to pixel data and you get instant posterization, color banding, the palette-reduced look of corrupted JPEG or over-compressed video. `HexNorm2` gives 8 bits — smooth enough to be clean, coarse enough to be manipulated by hand in live performance. `EncodingShortest` will aggressively collapse values to their most compact form, which is a lossy operation — running data through a save/load cycle with the wrong encoding is a free glitch effect.

The performer's interface to this is direct: change `H` to `J` on a line painting a Matrix and you have instantly posterized the buffer. No filter, no effect chain — just a letter.

### Matrix as Frame Buffer

The `Matrix` type with image interop (`writeImageData`, `saveImageData`) positions it naturally as a frame buffer. A live set could consist of a single Matrix being continuously rewritten by GGGCode commands — different lines painting different regions, different encodings introducing different artifacts, `Reference` subscripts scanning regions with range offsets that drift over time.

Ranges are the key here. `$frame[0:640|0:480]` addresses the entire buffer. `$frame[τ*π:640/4|0:480/3]` addresses a nonsense region that might wrap, might be invalid, might read garbage — and garbage, in this context, is texture. The fact that out-of-bounds coordinates return `-1` rather than throwing is the right behavior for a glitch context: the system degrades gracefully into noise rather than crashing.

### Line Orientation as a Performance Primitive

Live coding systems like TidalCycles and Sonic Pi use cycle-based evaluation: you change a pattern and it takes effect on the next cycle. GGGCode has no such mechanism natively, but its line orientation is a reasonable substitute under a simple REPL loop. Each line is an atomic gesture. A performer can:

- **Replace** a line: different region, different value, different encoding
- **Repeat** a line: flood fill, accumulation, burn-in
- **Corrupt** a line: change one character mid-sequence and re-send

The streaming parser accepts incremental input, so a live environment could pipe keystrokes directly to the machine. The `Runner`'s timeout semantics mean unfinished commands fail gracefully rather than hanging.

### What Is Missing

A true live code glitch language needs at least three things GGGCode lacks: **time**, **feedback**, and **self-modification**.

Time is the deepest absence. There is no scheduling primitive — no BPM, no cycle length, no `wait`, no `after`. A live GGGCode performance would need the host layer to provide a clock and loop, with GGGCode providing the content of each tick. This is not unreasonable — it is how Hydra and most shader-based live tools work — but it means the temporal structure of a piece is invisible in the GGGCode source itself.

Feedback means reading current state back into new commands. GGGCode has References, which can read Matrix values, but there is no conditional on those values in-language. You cannot write "if pixel at (x,y) is dark, paint it bright" in GGGCode — that logic must live in a hook. For glitch work this matters: feedback loops are a primary glitch technique (think video feedback, IIR filter instability, recursive image corruption). Without in-language conditionals, feedback loops require a TypeScript wrapper, which breaks the live-typing aesthetic.

Self-modification — programs that rewrite themselves — is absent entirely. There is no eval, no code-as-data beyond what `saveCode` provides for Matrix serialization. A program cannot generate new command lines and queue them. This forecloses the generative, self-evolving compositions that define the most interesting live code performances.

### The Verdict

GGGCode without extensions is a sketch tool for live glitch work, not a complete instrument. But it is a very good sketch tool. The hex encoding aesthetics, the built-in quantization steps, the Matrix frame buffer model, and the streaming parser together form a credible foundation. A thin host loop providing a clock and a REPL connection is enough to make it performable.

The missing pieces — time, feedback, self-modification — could be added as extensions without touching the core language. A `T0` command (timing/clock), a `C0` command (conditional), and an `E0` command (eval/emit) would complete the picture. The hook model is flexible enough to implement all three. The language is closer to a live glitch instrument than it looks, and further than it needs to be.
