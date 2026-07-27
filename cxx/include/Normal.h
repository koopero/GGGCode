#pragma once

#include "./ggg/ScaledNumber.h"

// Backwards-compatible spelling. It opts into float interoperability because
// existing host-side matrix callers construct normalized values from float.
// The fixed machine aliases use the same ScaledNumber primitive with that bridge
// disabled, making any accidental float dependency a compile error.
template <typename StorageType, StorageType OneValue, typename WorkingType>
using NormalizedNumber =
  ggg::ScaledNumber<StorageType, static_cast<std::int64_t>( OneValue ), WorkingType, true>;
