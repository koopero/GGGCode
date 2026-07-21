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
  // symbols[i-1] (numbers[0] has none). "Blank" -- the reference's isBlank() --
  // is carried by an explicit has* flag per field rather than a NaN sentinel:
  // blankness is a parse fact, not a numeric value, and a fixed-point NumberType
  // has no NaN to spell it with.
  //

  template <class T = DefaultTraits>
  struct RangeAxisT {
    using Number = typename T::Number;

    Number start = 0;
    Number end = 0;
    Number step = 0;
    Number count = 0;
    Number multiplier = 0;
    // Was the field written by the parser? The value is meaningless when false.
    bool hasStart = false;
    bool hasEnd = false;
    bool hasStep = false;
    bool hasCount = false;
    bool hasMultiplier = false;
    bool inclusive = false;
    // True when written with a trailing range symbol and no end ("1:", "1>"): an
    // OPEN range, which runs to the dimension it resolves against. Distinguishes
    // those from a lone axis value, which parses identically otherwise.
    bool open = false;
  };
  using RangeAxis = RangeAxisT<>;

  // T is not deducible from the arguments, so callers name it: buildAxes<T>(...).
  template <class T = DefaultTraits>
  inline std::vector<RangeAxisT<T>> buildAxes( const std::vector<typename T::Number> &numbers, const std::vector<Char> &symbols ) {
    std::vector<RangeAxisT<T>> axes;
    RangeAxisT<T> axis;
    int axisIndex = 0;

    for ( size_t i = 0; i < numbers.size(); i++ ) {
      // symbols normally has one entry between each pair of numbers; values that
      // enter without a preceding separator (a bare unitary/unicode constant
      // before another value) can leave it short, so bound the lookup.
      const Char symbolBefore = ( i >= 1 && i - 1 < symbols.size() ) ? symbols[i-1] : '\0';

      if ( symbolBefore == NextAxis ) {
        axes.push_back( axis );
        axis = RangeAxisT<T>();
        axisIndex = 0;
      }

      // The first number of an axis is the start; every later number is routed by
      // the symbol that PRECEDES it, not by position -- so components may be
      // skipped (e.g. "a*m" sets the multiplier with no range, "a/n" a bare count).
      if ( axisIndex == 0 ) {
        axis.start = numbers[i];
        axis.hasStart = true;
        axisIndex = 1;
      } else if ( symbolBefore == Range || symbolBefore == Uninclusive || symbolBefore == '<' ) {
        // ":"/">"/"<" fill the next empty slot: end -> step -> multiplier (a:b:s:m).
        if ( !axis.hasEnd ) {
          axis.end = numbers[i];
          axis.hasEnd = true;
          axis.inclusive = symbolBefore == Range;
        } else if ( !axis.hasStep ) {
          axis.step = numbers[i];
          axis.hasStep = true;
        } else {
          axis.multiplier = numbers[i];
          axis.hasMultiplier = true;
        }
      } else if ( symbolBefore == Count ) {
        axis.count = numbers[i];
        axis.hasCount = true;
      } else if ( symbolBefore == Multiplier ) {
        axis.multiplier = numbers[i];
        axis.hasMultiplier = true;
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
  template <class T = DefaultTraits>
  inline void resolveAxis( const RangeAxisT<T> &in, typename T::Number dimension, typename T::Number stride,
                           typename T::Number &first, typename T::Number &delta, long &count ) {
    using Number = typename T::Number;
    const bool inclusive = in.inclusive;

    Number start = in.hasStart ? in.start : 0;              // start = start || 0

    Number multiplier = in.hasMultiplier ? in.multiplier : stride;

    // A blank end runs to the dimension whether written ":" or ">"; the two
    // differ only in whether the endpoint itself is included. Callers with no
    // dimension pin the end to the start before getting here.
    Number end = in.hasEnd ? in.end : ( inclusive ? dimension - 1 : dimension );

    Number step = in.step;
    bool hasStep = in.hasStep;
    Number c = in.count;
    const bool hasCount = in.hasCount;

    // Blank OR zero: a written step of 0 is as unusable as an absent one, which
    // is what the reference's falsy !step test meant.
    if ( !hasStep || step == 0 ) {
      if ( hasCount && c != 0 ) {                              // count (truthy)
        step = ( end - start ) / ( c - ( inclusive ? 1 : 0 ) );
      } else {
        step = 1;
      }
      hasStep = true;
    }

    if ( !hasCount ) {
      // step is necessarily present here (the block above always supplies one),
      // so only its truthiness is left to test.
      if ( step != 0 ) {
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
  template <class T = DefaultTraits>
  struct CompoundExpansionT {
    using Number = typename T::Number;

    std::vector<Number> first;       // resolved start*mult per axis
    std::vector<Number> delta;       // resolved step*mult per axis
    std::vector<long>       count;   // resolved count per axis
    std::vector<long>       idx;     // odometer: current step per axis
    bool done = false;

    // Register-less expansion: every axis resolves against dimension 1 and stride
    // 1, matching Solve's register-less paths (the print compound and, faithfully,
    // $name[subscript] -- Solve drops the register inside the subscript array, so
    // the register's shape never sizes subscript ranges).
    // No open dimension in scope: an open axis has nothing to sweep to.
    explicit CompoundExpansionT( const std::vector<RangeAxisT<T>> &axes ) {
      init( axes, nullptr, nullptr, 0, false );
    }

    // openDim is the dimension an OPEN axis ("1:", "1>") sweeps to -- the size of
    // the register a subscript was written against. Coordinates stay
    // register-less (dimension/stride 1), so only the open END consults it.
    CompoundExpansionT( const std::vector<RangeAxisT<T>> &axes, Number openDim ) {
      init( axes, nullptr, nullptr, openDim, true );
    }

    // Coordinate-aware expansion: per-axis dimensions + strides (mirrors
    // Solve.solveRangeAxes with a register). Used by offset references
    // ($x@[...]), where each axis contributes coord*stride to the flat offset.
    // dims/strides must be sized to axes.
    CompoundExpansionT( const std::vector<RangeAxisT<T>> &axes,
                        const std::vector<Number> &dims,
                        const std::vector<Number> &strides ) {
      init( axes, &dims, &strides, 0, false );
    }

    void init( const std::vector<RangeAxisT<T>> &axes,
               const std::vector<Number> *dims,
               const std::vector<Number> *strides,
               Number openDim, bool hasOpenDim ) {
      const size_t n = axes.size();
      first.resize( n );
      delta.resize( n );
      count.resize( n );
      idx.assign( n, 0 );
      for ( size_t k = 0; k < n; k++ ) {
        const Number dim    = dims    ? (*dims)[k]    : 1;
        const Number stride = strides ? (*strides)[k] : 1;
        // An OPEN axis sweeps, but only when a dimension is in scope; a lone
        // coordinate value (blank end, no range symbol) is an EXACT single point
        // and pins to start even when one is. Mirrors solveOneAxis/pinBlankEnd
        // (ts/ggg/Solve.ts).
        RangeAxisT<T> axis = axes[k];
        const Number useDim = hasOpenDim ? openDim : dim;
        if ( !axis.hasEnd && !( axis.open && hasOpenDim ) ) {
          axis.end = axis.start;
          // A blank START leaves the end blank too, so resolveAxis still runs it
          // out to the dimension. "$x[:]" -- no numbers at all -- sweeps the
          // whole register on that strength.
          axis.hasEnd = axis.hasStart;
          axis.inclusive = true;
        }
        resolveAxis<T>( axis, useDim, stride, first[k], delta[k], count[k] );
        // Product semantics: any empty axis means the whole expansion is empty
        // (mirrors solveAxes looping zero times at that level).
        if ( count[k] == 0 ) done = true;
      }
      if ( n == 0 ) done = true;
    }

    bool next( Number &out ) {
      if ( done ) return false;

      Number value = 0;
      for ( size_t k = 0; k < idx.size(); k++ ) {
        value += first[k] + (Number) idx[k] * delta[k];
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
  using CompoundExpansion = CompoundExpansionT<>;
}; // namespace ggg
