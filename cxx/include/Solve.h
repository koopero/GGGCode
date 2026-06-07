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

      switch ( axisIndex++ ) {
        case 0:
          axis.start = numbers[i];
          break;
        case 1:
          axis.end = numbers[i];
          if ( symbolBefore == Range ) {
            axis.inclusive = true;
          } else if ( symbolBefore == Uninclusive || symbolBefore == '<' ) {
            axis.inclusive = false;
          }
          break;
        case 2:
          if ( symbolBefore == Count ) {
            axis.count = numbers[i];
          } else {
            axis.step = numbers[i];
          }
          break;
        case 3:
          axis.multiplier = numbers[i];
          break;
      }
    }

    // Trailing range symbol with no end value (open range, e.g. "1:").
    if ( !numbers.empty() && symbols.size() >= numbers.size() ) {
      if ( symbols[numbers.size()-1] == Range ) {
        axis.inclusive = true;
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

    if ( std::isnan( end ) ) {
      end = inclusive ? start : dimension;
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

    // `dimension` is the size an open/blank axis bound resolves against (e.g.
    // an open range `0:` ends at the dimension). The register-less compound
    // path passes 1; a $name[subscript] passes the register's scalar size so
    // subscript ranges resolve against it (mirrors Solve.solveRangeAxes).
    explicit CompoundExpansion( const std::vector<RangeAxis> &axes, NumberType dimension = 1 ) {
      const size_t n = axes.size();
      first.resize( n );
      delta.resize( n );
      count.resize( n );
      idx.assign( n, 0 );
      for ( size_t k = 0; k < n; k++ ) {
        resolveAxis( axes[k], dimension, 1, first[k], delta[k], count[k] );
        // Product semantics: any empty axis means the whole expansion is empty
        // (mirrors solveAxes looping zero times at that level). This also yields
        // the "a|b|c collapses to empty" quirk, since each lone value resolves
        // to count 0.
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
