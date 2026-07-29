# GGGCode Documentation

Start with the **[tour](tour.md)** for a guided introduction, then use the reference docs.

## Guides

- **[tour.md](tour.md)** — a guided walk through the language: numbers & encodings → ranges & sweeps → references → matrices → blit → flow control. Every GGG snippet is executed by the documentation test suite, with focused links into the conformance cases.
- **[runtime.md](runtime.md)** — how the runtime executes: the machine, the parse pipeline, the hook lifecycle, the lazy `Solve` generator, and matrix registers.
- **[protocol.md](protocol.md)** — how a machine describes its grammar, commands, result records, enums, and live references through `D1`/`D2`/`D4`/`D5`.
- **[cxx.md](cxx.md)** — C++17 setup, feature gates, numeric traits, the gggdx metadata boundary, and ESP32 size measurements.

## Reference

- **[cases.md](cases.md)** — *generated.* The living reference: every language feature as a runnable, visualized, conformance-tested example, grouped by tag. Built from `cases/*.yaml`.
- **[commands.md](commands.md)** — *generated.* Every command with its arguments, responses, and example links. Built from the subsystem command definitions.
- **[glossary.md](glossary.md)** — definitions for language concepts, argument codes, and the TypeScript API.

## How the docs stay correct

`cases.md`, its `img/*.svg` diagrams, and `commands.md` are **generated** — never edit them by hand. A case in `cases/*.yaml` is at once a spec, a documentation example, and a cross-engine (TS ↔ C++) conformance test, so the reference can't drift from behaviour. CI (`npm run check:codegen`) fails if any generated file is stale.

To regenerate after editing cases or commands:

```bash
npm run build:docs       # cases.md + img/*.svg
npm run build:commands   # commands.md
```
