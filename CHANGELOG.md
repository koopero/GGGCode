# Changelog

## 0.3.0 — 2026-07-29

GGGCode 0.3.0 makes the language self-describing, freezes compact operator
values, and turns the C++ port into a configurable embedded runtime with a
fixed-point default.

### Breaking changes

- Scalar operator values are now an explicit, frozen `0..57` wire enum. Numeric
  `Q` users must use the new values published by `D5`; named operators remain
  supported. Unknown operators now fail instead of silently becoming `set`.
- `clamp` consistently applies where the incoming mask is zero, and `hypot` is
  consistently binary as `hypot(current, incoming)` in TypeScript and C++.
- The CLI PNG option is now `-o` / `--output`; the former `--image` spelling is
  removed.
- The default C++ numeric traits use signed Q16.16 fixed point. Floating-point
  runtimes remain available through `FloatTraits` and `DoubleTraits`.

### Added

- Structured language self-description:
  - `D1` describes the complete language.
  - `D2` emits stable grammar rules and valid/invalid source examples.
  - `D4` lists command and result-record schemas.
  - `D5` lists enum and live-reference domains.
  - Results are GGG records (`D-20`, `D-21`, `D-40`–`D-42`, `D-50`, `D-51`),
    not comments.
- A shared enum repository used by TypeScript metadata, generated C++ headers,
  command argument domains, and self-description.
- C++17 numeric traits, named fixed-point presets, GLSL-style fixed math,
  integer CORDIC trigonometry, and scalar/component matrix accessors.
- C++ compile-time subsystem gates: `GGGPX_ENABLE`, `GGGGX_ENABLE`,
  `GGGTX_ENABLE`, `GGGDX_ENABLE`, `GGGGX_TRIG_ENABLE`, and
  `GGGGX_CORDIC_ENABLE`.
- G40 `offset` transform mode and compact numeric transform/operator selection.
- T9 iteration writes at an optional matrix offset selected by `P`.
- Sequenced PNG output templates such as `frame-%04d.png`.
- A complete Conway's Game of Life example.

### Verification and documentation

- TypeScript and C++ share 153 generated conformance cases.
- C++ feature-configuration probes verify documentation and math feature gates.
- New protocol, C++ runtime, glossary, command, and case documentation.

[0.3.0]: https://github.com/koopero/GGGCode/compare/v0.2.1...v0.3.0
