#pragma once

#include <cmath>
#include <vector>
#include "./Types.h"
#include "./autogen.h"

namespace ggg {
  //
  // Range / multi-axis expansion, ported from the TypeScript reference so the
  // streaming C++ parser produces the same values the TS Machine does.
  //
  //   - buildAxes()        mirrors ParseData.parseExpression (ts/ggg/ParseData.ts)
  //   - resolveAxis()      mirrors Solve.solveRangeAxis        (ts/ggg/Solve.ts)
  //   - CompoundExpansion  streams the register-less paths of Solve.solve /
  //                        Solve.solveRangeAxes, lazily (see below)
  //
  // The parser hands us a flat list of `numbers` plus the `symbols` it saw
  // between them ( : / > < * | ). symbols[i] is the separator that appeared
  // BETWEEN numbers[i] and numbers[i+1], so the symbol *before* numbers[i] is
  // symbols[i-1] (numbers[0] has none). NaN is used as the "blank" sentinel,
  // matching the reference's isBlank() / falsy-number checks.
  //

  struct RangeAxis {
    NumberType start = NAN;
    NumberType end = NAN;
    NumberType step = NAN;
    NumberType count = NAN;
    NumberType multiplier = NAN;
    bool inclusive = false;
    // True when written with a trailing range symbol and no end ("1:", "1>"): an
    // OPEN range, which runs to the dimension it resolves against. Distinguishes
    // those from a lone axis value, which parses identically otherwise.
    bool open = false;
  };

  inline std::vector<RangeAxis> buildAxes( const std::vector<NumberType> &numbers, const std::vector<Char> &symbols ) {
    std::vector<RangeAxis> axes;
    RangeAxis axis;
    int axisIndex = 0;

    for ( size_t i = 0; i < numbers.size(); i++ ) {
      // symbols normally has one entry between each pair of numbers; values that
      // enter without a preceding separator (a bare unitary/unicode constant
      // before another value) can leave it short, so bound the lookup.
      const Char symbolBefore = ( i >= 1 && i - 1 < symbols.size() ) ? symbols[i-1] : '\0';

      if ( symbolBefore == NextAxis ) {
        axes.push_back( axis );
        axis = RangeAxis();
        axisIndex = 0;
      }

      // The first number of an axis is the start; every later number is routed by
      // the symbol that PRECEDES it, not by position -- so components may be
      // skipped (e.g. "a*m" sets the multiplier with no range, "a/n" a bare count).
      if ( axisIndex == 0 ) {
        axis.start = numbers[i];
        axisIndex = 1;
      } else if ( symbolBefore == Range || symbolBefore == Uninclusive || symbolBefore == '<' ) {
        // ":"/">"/"<" fill the next empty slot: end -> step -> multiplier (a:b:s:m).
        if ( std::isnan( axis.end ) ) {
          axis.end = numbers[i];
          axis.inclusive = symbolBefore == Range;
        } else if ( std::isnan( axis.step ) ) {
          axis.step = numbers[i];
        } else {
          axis.multiplier = numbers[i];
        }
      } else if ( symbolBefore == Count ) {
        axis.count = numbers[i];
      } else if ( symbolBefore == Multiplier ) {
        axis.multiplier = numbers[i];
      }
    }

    // Trailing range symbol with no end value is an OPEN range ("1:", "1>").
    if ( !numbers.empty() && symbols.size() >= numbers.size() ) {
      const Char trailing = symbols[numbers.size()-1];
      if ( trailing == Range ) {
        axis.open = true;
        axis.inclusive = true;
      } else if ( trailing == Uninclusive ) {
        axis.open = true;
        axis.inclusive = false;
      }
    }

    axes.push_back( axis );
    return axes;
  }

  // Resolve a single axis into the concrete (first value, step, count) the
  // expansion will walk. This is a faithful port of Solve.solveRangeAxis's
  // start/end/step/count derivation (ts/ggg/Solve.ts); the register-less
  // compound path always passes dimension = stride = 1.
  //
  // solveRangeAxis yields ( start + i*step ) * multiplier, so we fold the
  // multiplier into the cached first/step values:
  //   first = start * multiplier,  delta = step * multiplier.
  inline void resolveAxis( const RangeAxis &in, NumberType dimension, NumberType stride, NumberType &first, NumberType &delta, long &count ) {
    NumberType start = in.start;
    NumberType end = in.end;
    NumberType c = in.count;
    NumberType step = in.step;
    NumberType multiplier = in.multiplier;
    const bool inclusive = in.inclusive;

    if ( std::isnan( start ) ) start = 0;                       // start = start || 0

    if ( std::isnan( multiplier ) ) multiplier = stride;

    // A blank end runs to the dimension whether written ":" or ">"; the two
    // differ only in whether the endpoint itself is included. Callers with no
    // dimension pin the end to the start before getting here.
    if ( std::isnan( end ) ) {
      end = inclusive ? dimension - 1 : dimension;
    }

    if ( std::isnan( step ) || step == 0 ) {                    // !step
      if ( !std::isnan( c ) && c != 0 ) {                      // count (truthy)
        step = ( end - start ) / ( c - ( inclusive ? 1 : 0 ) );
      } else {
        step = 1;
      }
    }

    if ( std::isnan( c ) ) {                                    // isBlank( count )
      if ( !std::isnan( step ) && step != 0 ) {                // step (truthy)
        c = std::floor( ( end - start ) / step );
        if ( inclusive ) c += 1;
      } else {
        c = 1;
      }
    }

    first = start * multiplier;
    delta = step * multiplier;
    count = c < 0 ? 0 : (long) c;
  }

  //
  // Lazy, cancellable expansion of a compound (range / multi-axis) value.
  //
  // Replaces the eager solveCompound vector: instead of materializing every
  // value up front (O(values) heap), CompoundExpansion holds only the small
  // per-axis state (O(axes), stack) and streams one value per next() call,
  // mirroring the TS Solve generator. The nested recursion of Solve's
  // solveRangeAxes is reified into an odometer: idx[0] is the fastest-changing
  // (innermost) axis, matching solveAxes' index-0-innermost recursion. Each
  // value is the coordinate-wise sum over axes ( solveAxes' val + offset ).
  //
  // Cancellation: a consumer simply stops calling next() (e.g. `break`s the
  // loop) -- no further values are computed.
  //
  struct CompoundExpansion {
    std::vector<NumberType> first;   // resolved start*mult per axis
    std::vector<NumberType> delta;   // resolved step*mult per axis
    std::vector<long>       count;   // resolved count per axis
    std::vector<long>       idx;     // odometer: current step per axis
    bool done = false;

    // Register-less expansion: every axis resolves against dimension 1 and stride
    // 1, matching Solve's register-less paths (the print compound and, faithfully,
    // $name[subscript] -- Solve drops the register inside the subscript array, so
    // the register's shape never sizes subscript ranges).
    // openDim (NAN = none) is the dimension an OPEN axis ("1:", "1>") sweeps to
    // -- the size of the register a subscript was written against. Coordinates
    // stay register-less (dimension/stride 1), so only the open END consults it.
    explicit CompoundExpansion( const std::vector<RangeAxis> &axes, NumberType openDim = NAN ) {
      init( axes, nullptr, nullptr, openDim );
    }

    // Coordinate-aware expansion: per-axis dimensions + strides (mirrors
    // Solve.solveRangeAxes with a register). Used by offset references
    // ($x@[...]), where each axis contributes coord*stride to the flat offset.
    // dims/strides must be sized to axes.
    CompoundExpansion( const std::vector<RangeAxis> &axes,
                       const std::vector<NumberType> &dims,
                       const std::vector<NumberType> &strides ) {
      init( axes, &dims, &strides, NAN );
    }

    void init( const std::vector<RangeAxis> &axes,
               const std::vector<NumberType> *dims,
               const std::vector<NumberType> *strides,
               NumberType openDim ) {
      const size_t n = axes.size();
      first.resize( n );
      delta.resize( n );
      count.resize( n );
      idx.assign( n, 0 );
      for ( size_t k = 0; k < n; k++ ) {
        const NumberType dim    = dims    ? (*dims)[k]    : 1;
        const NumberType stride = strides ? (*strides)[k] : 1;
        // An OPEN axis sweeps, but only when a dimension is in scope; a lone
        // coordinate value (blank end, no range symbol) is an EXACT single point
        // and pins to start even when one is. Mirrors solveOneAxis/pinBlankEnd
        // (ts/ggg/Solve.ts).
        RangeAxis axis = axes[k];
        const bool hasOpenDim = !std::isnan( openDim );
        const NumberType useDim = hasOpenDim ? openDim : dim;
        if ( std::isnan( axis.end ) && !( axis.open && hasOpenDim ) ) {
          axis.end = axis.start;
          axis.inclusive = true;
        }
        resolveAxis( axis, useDim, stride, first[k], delta[k], count[k] );
        // Product semantics: any empty axis means the whole expansion is empty
        // (mirrors solveAxes looping zero times at that level).
        if ( count[k] == 0 ) done = true;
      }
      if ( n == 0 ) done = true;
    }

    bool next( NumberType &out ) {
      if ( done ) return false;

      NumberType value = 0;
      for ( size_t k = 0; k < idx.size(); k++ ) {
        value += first[k] + (NumberType) idx[k] * delta[k];
      }
      out = value;

      // Advance the odometer: bump the innermost axis, carrying outward.
      for ( size_t k = 0; k < idx.size(); k++ ) {
        if ( ++idx[k] < count[k] ) {
          return true;
        }
        idx[k] = 0;                  // overflow this axis, carry to the next
      }
      done = true;                   // outermost axis overflowed: exhausted
      return true;
    }
  };
}; // namespace ggg
