# GGGCode C++ Runtime

The C++ implementation is a header-only C++17 runtime under `cxx/include`.
It shares generated protocol enums and the conformance corpus with the
TypeScript reference implementation.

## Minimal program

[`example/cxx_minimal.cpp`](../example/cxx_minimal.cpp) is compiled as part of
the repository checks:

```cpp
#include <iostream>
#include "ggg.h"

class ConsoleRuntime final : public ggg::Runtime {
public:
  void write( const ggg::String &text ) override {
    std::cout << text;
  }
};

int main() {
  ConsoleRuntime runtime;
  runtime.run( "P10 V1:3\n" );
  return 0;
}
```

From a source checkout:

```bash
c++ -std=c++17 -Os -I cxx/include example/cxx_minimal.cpp -o ggg-example
./ggg-example
```

Expected output:

```text
V1,2,3
OK
```

The npm package also includes the public headers and example:

```bash
npm install gggcode
c++ -std=c++17 -Os \
  -I node_modules/gggcode/cxx/include \
  node_modules/gggcode/example/cxx_minimal.cpp \
  -o ggg-example
```

On Arduino or PlatformIO, add `cxx/include` to the compiler include path, derive
from `ggg::Runtime` to route `write()` to the serial or transport layer, and
feed complete lines through `run()` or individual characters through `input()`.
Call `poll(millis())` from the host loop when `gggtx` asynchronous procedures
are enabled.

## Runtime composition

`ggg::RuntimeT<Traits>` derives from `MachineT<Traits>` and registers the
command families selected by `Config.h`. `ggg::Runtime` uses the default
numeric traits. A custom `MachineT` can instead call:

```cpp
ggg::MachineT<ggg::FixedTraits> machine;
ggg::addConfiguredCommands( &machine );
```

All gates are numeric preprocessor definitions and default to enabled:

| definition | controls |
| --- | --- |
| `GGGPX_ENABLE` | `P10`/`P13` print and processing commands. |
| `GGGGX_ENABLE` | C++ matrix read, write, blit, sampling, storage, and operator support. |
| `GGGTX_ENABLE` | Blocks, bounded iteration, procedures, async export, and their machine state. |
| `GGGDX_ENABLE` | D commands, message metadata, enum descriptors, and machine enum-domain state. |
| `GGGGX_TRIG_ENABLE` | Circular trigonometric operator semantics. Requires `GGGGX_ENABLE`. |
| `GGGGX_CORDIC_ENABLE` | Fixed-point CORDIC implementation. Requires `GGGGX_TRIG_ENABLE`. |

For example, a graphics runtime without flow, self-documentation, or fixed
CORDIC:

```ini
build_flags =
  -DGGGPX_ENABLE=0
  -DGGGGX_ENABLE=1
  -DGGGTX_ENABLE=0
  -DGGGDX_ENABLE=0
  -DGGGGX_CORDIC_ENABLE=0
```

The gates remove storage as well as dispatch:

- `GGGDX_ENABLE=0` removes command descriptions, argument/response metadata,
  generated enum descriptors, machine enum-domain state, and all D handlers.
- `GGGTX_ENABLE=0` removes procedure registers, capture frames, the pending
  work queue, and the async schedule.
- Disabled graphics/trig features are also absent from a D5 response when
  documentation remains enabled.

The six supported feature combinations are compile-tested by
`npm run test:cxx-config`.

## Command metadata and gggdx

C++ command classes own their executable hooks. When `GGGDX_ENABLE=1`, the same
classes also carry generated descriptions for their arguments, responses,
examples, controls, result records, and enum domains. `addConfiguredCommands()`
registers both the handler and its domains with the machine. `D4` walks that
command/message metadata; `D5` walks the machine-scoped domain repository; and
`D6` emits the opaque JSON objects registered with `addControl()`:

```cpp
addExample( "GK", "Repeat to size." );
addControl( R"({})" ); // Replace with an object from the external UI schema.
```

Each `addControl()` value must be one compact JSON object. It is emitted through
`D-60 V\`` without requiring a JSON library in the embedded runtime.

With `GGGDX_ENABLE=0`, those fields do not exist in the compiled types. This is
a compile-time boundary rather than a runtime flag, so documentation strings
and repositories can be removed by the linker instead of merely becoming
unreachable.

See the [protocol guide](protocol.md) for the record model visible on the wire.

## Numeric traits

The default `ggg::FloatTraits` uses single-precision float language/register
values and double-precision sampler coordinates. Select another IEEE backend
per runtime when needed:

```cpp
ggg::RuntimeT<ggg::DoubleTraits> precise;
```

Fixed point is an explicit opt-in. `ggg::FixedTraits` uses signed Q16.16 values:

- storage: `int32_t`
- resolution: `1/65536`
- approximate range: `-32768` through `32767.99998`
- integer parsing, formatting, ranges, matrix sampling, and CORDIC

Select it per runtime:

```cpp
ggg::RuntimeT<ggg::FixedTraits> fixed;
```

Or select it for the whole build:

```text
-DGGG_DEFAULT_TRAITS=::ggg::FixedTraits
```

The fixed number type deliberately has no implicit floating-point constructor
or conversion. An accidental float seam therefore fails at compile time rather
than quietly importing floating-point helpers into firmware.

Fixed `sin`, `cos`, `atan`, and `atan2` use the 24-step integer CORDIC kernel
when enabled. Operators without a fixed kernel report `BadOperator`; float and
double traits use their IEEE implementations while trigonometry is enabled.

## ESP32 reference size

These are reference measurements, not ABI guarantees. They were produced with
PlatformIO espressif32 6.9, the Arduino framework, `esp32dev`, `-Os`, Q16.16,
and CORDIC:

| build | flash | static RAM | registered commands |
| --- | ---: | ---: | --- |
| ggggx only | 317,153 B | 21,956 B | `G10`, `G20`, `G40` |
| kitchen sink | 363,201 B | 22,036 B | 14 commands |
| difference | 46,048 B | 80 B | print + flow + documentation |

The flash difference was approximately 25,544 bytes of text, 20,480 bytes of
read-only data, and 24 bytes of IRAM. Toolchain, framework, board support, and
application code all affect the final binary, so compare configurations within
one build environment rather than treating these as universal constants.
