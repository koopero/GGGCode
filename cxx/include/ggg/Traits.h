#pragma once

namespace ggg {
  //
  // The machine's compile-time configuration. Every class that touches numbers
  // is templated on one of these, so the numeric type is substitutable without
  // editing the library:
  //
  //   ggg::MachineT<ggg::DoubleTraits> m;
  //
  // Only Number varies today. Index / Int / Char / String / DimType stay as the
  // global typedefs in Types.h -- parameterizing those would reach into List,
  // Dim and the codegen for no current benefit -- but this struct is where they
  // join when that changes.
  //
  // A substituted Number needs arithmetic, comparison, and a NumberOps<N>
  // specialization (see NumberOps.h) for the few things arithmetic cannot say.
  // It does NOT need a spare representation to stand in for "blank": that is
  // carried by explicit flags, not a sentinel value.
  //
  struct FloatTraits  { using Number = float;  };
  struct DoubleTraits { using Number = double; };

  // The traits every legacy alias (ggg::Machine, ggg::MatrixBase, ...) resolves
  // to, and the default for every template parameter. Override for a whole
  // build with -DGGG_DEFAULT_TRAITS=::my::FixedTraits; there is deliberately no
  // way to change it per translation unit, since the aliases would then differ
  // across TUs and quietly break the one-definition rule.
  #ifndef GGG_DEFAULT_TRAITS
  #define GGG_DEFAULT_TRAITS ::ggg::FloatTraits
  #endif
  using DefaultTraits = GGG_DEFAULT_TRAITS;
}; // namespace ggg
