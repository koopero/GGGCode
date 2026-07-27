#pragma once
#include "./ScaledNumber.h"

namespace ggg {
  //
  // The machine's compile-time configuration. Every class that touches numbers
  // is templated on one of these, so the numeric type is substitutable without
  // editing the library:
  //
  //   ggg::MachineT<ggg::DoubleTraits> m;
  //
  // Number is the language/register value. Coordinate is the sampler/blitter's
  // normalized working type: it may trade range for precision independently,
  // while still using the same primitive in a fixed-only build. Index / Int /
  // Char / String / DimType stay global.
  //
  // A substituted Number needs arithmetic, comparison, and a NumberOps<N>
  // specialization (see NumberOps.h) for the few things arithmetic cannot say.
  // It does NOT need a spare representation to stand in for "blank": that is
  // carried by explicit flags, not a sentinel value.
  //
  struct FloatTraits  { using Number = float;  using Coordinate = double; };
  struct DoubleTraits { using Number = double; using Coordinate = double; };
  struct FixedTraits  {
    using Number = FixedQ16_16;
    using Coordinate = FixedCoordinate;
  };

  // The traits every legacy alias (ggg::Machine, ggg::MatrixBase, ...) resolves
  // to, and the default for every template parameter. Override for a whole
  // build with -DGGG_DEFAULT_TRAITS=::ggg::FloatTraits (or custom traits); there
  // is deliberately no
  // way to change it per translation unit, since the aliases would then differ
  // across TUs and quietly break the one-definition rule.
  #ifndef GGG_DEFAULT_TRAITS
  #define GGG_DEFAULT_TRAITS ::ggg::FixedTraits
  #endif
  using DefaultTraits = GGG_DEFAULT_TRAITS;
}; // namespace ggg
