#pragma once
#include "./Config.h"
#if GGGGX_ENABLE

#include <cmath>
#include <cstdlib>
#include "./Types.h"
#include "./ggg/ScaledNumber.h"
#include "./ggg/NumberOps.h"
#include "./ggg/ScaledMath.h"
#include "./gen/Operators.h"

namespace ggg {
  //
  // Scalar write operators (the Q arg of ggggx MatrixWrite). Stable IDs and
  // names are generated from ts/ggggx/Operators.ts; only the numeric
  // implementation is hand-written here.
  //
  // OperatorApply(op, a, b): a = current cell value, b = the incoming V value.
  // Binary ops use both; the unary ops use b as a guard (apply f(a) iff b == 0,
  // else leave a unchanged), exactly mirroring the `!b ? f(a) : a` TS pattern.
  //
  // Returns false for an unknown operator (caller decides how to fail).
  //
  template <typename N>
  inline bool applyOperator( OperatorId op, N a, N b, N & out ) {
    auto guard = [&]( N v ) -> N { return ( b == 0 ) ? v : a; };
    auto boolOf = [&]( bool v ) -> N { return v ? 1 : 0; };

    switch ( op ) {
      case OperatorId::Nop:   out = a; return true;
      case OperatorId::Set:   out = b; return true;
      case OperatorId::Add:   out = a + b; return true;
      case OperatorId::Mult:  out = a * b; return true;
      case OperatorId::Min:   out = a < b ? a : b; return true;
      case OperatorId::Max:   out = a > b ? a : b; return true;
      case OperatorId::Sub:   out = a - b; return true;
      case OperatorId::Div:   out = a / b; return true;
      case OperatorId::Neg:   out = guard( -a ); return true;
      case OperatorId::Clamp: out = guard( a < 0 ? 0 : ( a > 1 ? 1 : a ) ); return true;
      case OperatorId::Rsub:  out = b - a; return true;
      case OperatorId::Rdiv:  out = b / a; return true;
      case OperatorId::Mod:   out = std::fmod( a, b ); return true;
      case OperatorId::Rmod:  out = std::fmod( b, a ); return true;
      case OperatorId::Pow:   out = std::pow( a, b ); return true;
      case OperatorId::Rpow:  out = std::pow( b, a ); return true;
      case OperatorId::Mid:   out = ( a + b ) / 2; return true;
      case OperatorId::Zero:  out = guard( 0 ); return true;
      case OperatorId::Bool:  out = boolOf( a != 0 ); return true;
      case OperatorId::Not:   out = guard( boolOf( a == 0 ) ); return true;
      case OperatorId::Sign:  out = guard( (N)( ( a > 0 ) - ( a < 0 ) ) ); return true;
      case OperatorId::Inv:   out = guard( 1 / a ); return true;
      case OperatorId::Abs:   out = guard( std::fabs( a ) ); return true;
      case OperatorId::Sqrt:  out = guard( std::sqrt( a ) ); return true;
      case OperatorId::Inc:   out = guard( a + 1 ); return true;
      case OperatorId::Dec:   out = guard( a - 1 ); return true;
      case OperatorId::Floor: out = guard( std::floor( a ) ); return true;
      case OperatorId::Ceil:  out = guard( std::ceil( a ) ); return true;
      case OperatorId::Round: out = guard( std::round( a ) ); return true;
      case OperatorId::Trunc: out = guard( std::trunc( a ) ); return true;
      case OperatorId::Rand:
        out = guard( (N) std::rand() / ( (N) RAND_MAX + 1 ) ); return true;
      case OperatorId::And: out = boolOf( a != 0 && b != 0 ); return true;
      case OperatorId::Or:  out = boolOf( a != 0 || b != 0 ); return true;
      case OperatorId::Xor: out = boolOf( ( (long) a ^ (long) b ) != 0 ); return true;
      case OperatorId::Eq:  out = boolOf( a == b ); return true;
      case OperatorId::Ne:  out = boolOf( a != b ); return true;
      case OperatorId::Lt:  out = boolOf( a < b ); return true;
      case OperatorId::Le:  out = boolOf( a <= b ); return true;
      case OperatorId::Gt:  out = boolOf( a > b ); return true;
      case OperatorId::Ge:  out = boolOf( a >= b ); return true;
      case OperatorId::Exp:   out = guard( std::exp( a ) ); return true;
      case OperatorId::Log:   out = guard( std::log( a ) ); return true;
      case OperatorId::Log2:  out = guard( std::log2( a ) ); return true;
      case OperatorId::Log10: out = guard( std::log10( a ) ); return true;
      case OperatorId::Hypot: out = std::hypot( a, b ); return true;
      #if GGGGX_TRIG_ENABLE
      case OperatorId::Sin:   out = guard( std::sin( a ) ); return true;
      case OperatorId::Cos:   out = guard( std::cos( a ) ); return true;
      case OperatorId::Tan:   out = guard( std::tan( a ) ); return true;
      case OperatorId::Asin:  out = guard( std::asin( a ) ); return true;
      case OperatorId::Acos:  out = guard( std::acos( a ) ); return true;
      case OperatorId::Atan:  out = guard( std::atan( a ) ); return true;
      case OperatorId::Atan2: out = std::atan2( a, b ); return true;
      #endif
      case OperatorId::Sinh:  out = guard( std::sinh( a ) ); return true;
      case OperatorId::Cosh:  out = guard( std::cosh( a ) ); return true;
      case OperatorId::Tanh:  out = guard( std::tanh( a ) ); return true;
      case OperatorId::Asinh: out = guard( std::asinh( a ) ); return true;
      case OperatorId::Acosh: out = guard( std::acosh( a ) ); return true;
      case OperatorId::Atanh: out = guard( std::atanh( a ) ); return true;
      default: out = a; return false;
    }
  }

  inline std::uint64_t operatorIntegerSqrt( std::uint64_t value ) {
    // Restoring integer square root: fixed iteration count, no division and no
    // floating-point helper. Returns floor(sqrt(value)).
    std::uint64_t result = 0;
    std::uint64_t bit = std::uint64_t( 1 ) << 62;
    while ( bit > value ) bit >>= 2;
    while ( bit ) {
      if ( value >= result + bit ) {
        value -= result + bit;
        result = ( result >> 1 ) + bit;
      } else {
        result >>= 1;
      }
      bit >>= 2;
    }
    return result;
  }

  //
  // Float-free operator table for scaled integers. The arithmetic/logical
  // operators and integer sqrt are supported. Transcendentals that do not yet
  // have an integer kernel fail explicitly, producing the existing BadOperator
  // response instead of quietly crossing through libm.
  //
  template <typename Rep, std::int64_t Scale, typename Wide, bool FloatInterop>
  inline bool applyOperator(
    OperatorId op,
    ScaledNumber<Rep, Scale, Wide, FloatInterop> a,
    ScaledNumber<Rep, Scale, Wide, FloatInterop> b,
    ScaledNumber<Rep, Scale, Wide, FloatInterop> &out
  ) {
    using N = ScaledNumber<Rep, Scale, Wide, FloatInterop>;
    auto guard = [&]( N v ) -> N { return b == 0 ? v : a; };
    auto boolOf = [&]( bool v ) -> N { return v ? 1 : 0; };

    switch ( op ) {
      case OperatorId::Nop:   out = a; return true;
      case OperatorId::Set:   out = b; return true;
      case OperatorId::Add:   out = a + b; return true;
      case OperatorId::Mult:  out = a * b; return true;
      case OperatorId::Min:   out = a < b ? a : b; return true;
      case OperatorId::Max:   out = a > b ? a : b; return true;
      case OperatorId::Sub:   out = a - b; return true;
      case OperatorId::Div:   out = a / b; return true;
      case OperatorId::Neg:   out = guard( -a ); return true;
      case OperatorId::Clamp:
        out = guard( a < 0 ? N( 0 ) : ( a > 1 ? N( 1 ) : a ) ); return true;
      case OperatorId::Rsub: out = b - a; return true;
      case OperatorId::Rdiv: out = b / a; return true;
      case OperatorId::Mod:
        if ( b.raw() == 0 ) return false;
        out = N::fromRaw( static_cast<Wide>( a.raw() ) % static_cast<Wide>( b.raw() ) );
        return true;
      case OperatorId::Rmod:
        if ( a.raw() == 0 ) return false;
        out = N::fromRaw( static_cast<Wide>( b.raw() ) % static_cast<Wide>( a.raw() ) );
        return true;
      case OperatorId::Mid: out = ( a + b ) / 2; return true;
      case OperatorId::Zero: out = guard( 0 ); return true;
      case OperatorId::Bool: out = boolOf( a != 0 ); return true;
      case OperatorId::Not: out = guard( boolOf( a == 0 ) ); return true;
      case OperatorId::Sign:
        out = guard( N( ( a > 0 ) - ( a < 0 ) ) ); return true;
      case OperatorId::Inv: out = guard( N( 1 ) / a ); return true;
      case OperatorId::Abs: out = guard( a < 0 ? -a : a ); return true;
      case OperatorId::Sqrt: {
        if ( b != 0 ) { out = a; return true; }
        if ( a < 0 ) return false;
        const std::uint64_t radicand =
          static_cast<std::uint64_t>( a.raw() )
          * static_cast<std::uint64_t>( Scale );
        out = N::fromRaw( static_cast<Wide>( operatorIntegerSqrt( radicand ) ) );
        return true;
      }
      case OperatorId::Inc: out = guard( a + 1 ); return true;
      case OperatorId::Dec: out = guard( a - 1 ); return true;
      case OperatorId::Floor:
        out = guard( NumberOps<N>::floor( a ) ); return true;
      case OperatorId::Ceil: {
        N floor = NumberOps<N>::floor( a );
        out = guard( a == floor ? floor : floor + 1 );
        return true;
      }
      case OperatorId::Round: {
        const Wide raw = static_cast<Wide>( a.raw() );
        const Wide half = static_cast<Wide>( Scale / 2 );
        const Wide units = raw < 0
          ? ( raw - half ) / static_cast<Wide>( Scale )
          : ( raw + half ) / static_cast<Wide>( Scale );
        out = guard( N( units ) );
        return true;
      }
      case OperatorId::Trunc:
        out = guard( N( static_cast<long>( a ) ) ); return true;
      case OperatorId::Rand:
        out = guard( N::fromRatio(
          static_cast<Wide>( std::rand() ),
          static_cast<Wide>( RAND_MAX ) + 1
        ) );
        return true;
      case OperatorId::And: out = boolOf( a != 0 && b != 0 ); return true;
      case OperatorId::Or:  out = boolOf( a != 0 || b != 0 ); return true;
      case OperatorId::Xor:
        out = boolOf( ( static_cast<long>( a ) ^ static_cast<long>( b ) ) != 0 );
        return true;
      case OperatorId::Eq: out = boolOf( a == b ); return true;
      case OperatorId::Ne: out = boolOf( a != b ); return true;
      case OperatorId::Lt: out = boolOf( a < b ); return true;
      case OperatorId::Le: out = boolOf( a <= b ); return true;
      case OperatorId::Gt: out = boolOf( a > b ); return true;
      case OperatorId::Ge: out = boolOf( a >= b ); return true;
      case OperatorId::Hypot: {
        const Wide ar = static_cast<Wide>( a.raw() );
        const Wide br = static_cast<Wide>( b.raw() );
        const std::uint64_t am = static_cast<std::uint64_t>( ar < 0 ? -ar : ar );
        const std::uint64_t bm = static_cast<std::uint64_t>( br < 0 ? -br : br );
        out = N::fromRaw( static_cast<Wide>( operatorIntegerSqrt( am * am + bm * bm ) ) );
        return true;
      }
      #if GGGGX_CORDIC_ENABLE
      case OperatorId::Sin: out = guard( ggg::sin( a ) ); return true;
      case OperatorId::Cos: out = guard( ggg::cos( a ) ); return true;
      case OperatorId::Atan: out = guard( ggg::atan( a ) ); return true;
      case OperatorId::Atan2: out = ggg::atan2( a, b ); return true;
      #endif
      // exp/log, pow, remaining trig, and hyperbolic functions do not yet
      // have fixed-point kernels.
      default: out = a; return false;
    }
  }

  // String names remain a public convenience, but resolve once to the same
  // generated ID used by compact numeric Q values.
  template <typename N>
  inline bool applyOperator( const String &name, N a, N b, N &out ) {
    return applyOperator( operatorIdByName( name ), a, b, out );
  }
}
#endif
