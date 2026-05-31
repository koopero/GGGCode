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
  //   - buildAxes()      mirrors ParseData.parseExpression (ts/ggg/ParseData.ts)
  //   - solveRangeAxis() mirrors Solve.solveRangeAxis        (ts/ggg/Solve.ts)
  //   - solveCompound()  mirrors the register-less paths of Solve.solve /
  //                      Solve.solveRangeAxes
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

  inline void solveRangeAxis( const RangeAxis &in, NumberType dimension, NumberType stride, std::vector<NumberType> &out ) {
    NumberType start = in.start;
    NumberType end = in.end;
    NumberType count = in.count;
    NumberType step = in.step;
    NumberType multiplier = in.multiplier;
    const bool inclusive = in.inclusive;

    if ( std::isnan( start ) ) start = 0;                       // start = start || 0

    if ( std::isnan( multiplier ) ) multiplier = stride;

    if ( std::isnan( end ) ) {
      end = inclusive ? start : dimension;
    }

    if ( std::isnan( step ) || step == 0 ) {                    // !step
      if ( !std::isnan( count ) && count != 0 ) {              // count (truthy)
        step = ( end - start ) / ( count - ( inclusive ? 1 : 0 ) );
      } else {
        step = 1;
      }
    }

    if ( std::isnan( count ) ) {                                // isBlank( count )
      if ( !std::isnan( step ) && step != 0 ) {                // step (truthy)
        count = std::floor( ( end - start ) / step );
        if ( inclusive ) count += 1;
      } else {
        count = 1;
      }
    }

    NumberType val = start;
    for ( long i = 0; (NumberType) i < count; i++ ) {
      out.push_back( val * multiplier );
      val += step;
    }
  }

  // Nested expansion for multi-axis values ( a|b|c ), register-less: every
  // dimension defaults to 1 and every stride to 1 (Solve.solveRangeAxes).
  inline void solveAxes( const std::vector<RangeAxis> &axes, int index, NumberType offset, std::vector<NumberType> &out ) {
    std::vector<NumberType> vals;
    solveRangeAxis( axes[index], 1, 1, vals );
    for ( NumberType val : vals ) {
      if ( index == 0 ) {
        out.push_back( val + offset );
      } else {
        solveAxes( axes, index - 1, val + offset, out );
      }
    }
  }

  inline std::vector<NumberType> solveCompound( const std::vector<NumberType> &numbers, const std::vector<Char> &symbols ) {
    std::vector<NumberType> out;
    std::vector<RangeAxis> axes = buildAxes( numbers, symbols );
    if ( axes.size() == 1 ) {
      solveRangeAxis( axes[0], 1, 1, out );
    } else {
      solveAxes( axes, (int) axes.size() - 1, 0, out );
    }
    return out;
  }
}; // namespace ggg
