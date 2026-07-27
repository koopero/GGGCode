#pragma once

#include <cmath>
#include <cstdlib>
#include "./Types.h"
#include "./ggg/ScaledNumber.h"
#include "./ggg/NumberOps.h"

namespace ggg {
  //
  // Scalar write operators (the Q arg of ggggx MatrixWrite). Hand-port of the
  // operator table in ts/ggggx/Operators.ts -- kept in sync by hand (the TS fns
  // are JS closures, not codegen-able). On a float build the transcendental
  // results rely on the conformance value-tolerance to agree with TS double.
  //
  // OperatorApply(op, a, b): a = current cell value, b = the incoming V value.
  // Binary ops use both; the unary ops use b as a guard (apply f(a) iff b == 0,
  // else leave a unchanged), exactly mirroring the `!b ? f(a) : a` TS pattern.
  //
  // Returns false for an unknown operator (caller decides how to fail).
  //
  template <typename N>
  inline bool applyOperator( const String & op, N a, N b, N & out ) {
    auto guard = [&]( N v ) -> N { return ( b == 0 ) ? v : a; };
    auto boolOf = [&]( bool v ) -> N { return v ? 1 : 0; };

    // --- core ---
    if ( op == "nop" )   { out = a;          return true; }
    if ( op == "set" )   { out = b;          return true; }
    if ( op == "bool" )  { out = boolOf( a != 0 );             return true; }
    if ( op == "clamp" ) { out = guard( a < 0 ? 0 : ( a > 1 ? 1 : a ) ); return true; }
    if ( op == "zero" )  { out = guard( 0 );                  return true; }
    if ( op == "rand" )  { out = guard( (N) std::rand() / ( (N) RAND_MAX + 1 ) ); return true; }

    // --- unary (guarded by b == 0) ---
    if ( op == "dec" )   { out = guard( a - 1 );   return true; }
    if ( op == "inc" )   { out = guard( a + 1 );   return true; }
    if ( op == "neg" )   { out = guard( -a );      return true; }
    if ( op == "not" )   { out = guard( boolOf( a == 0 ) ); return true; }
    if ( op == "sqrt" )  { out = guard( std::sqrt( a ) );  return true; }
    if ( op == "inv" )   { out = guard( 1 / a );   return true; }
    if ( op == "abs" )   { out = guard( std::fabs( a ) );  return true; }
    if ( op == "ceil" )  { out = guard( std::ceil( a ) );  return true; }
    if ( op == "floor" ) { out = guard( std::floor( a ) ); return true; }
    if ( op == "round" ) { out = guard( std::round( a ) ); return true; }
    if ( op == "trunc" ) { out = guard( std::trunc( a ) ); return true; }
    if ( op == "sign" )  { out = guard( (N)( ( a > 0 ) - ( a < 0 ) ) ); return true; }
    if ( op == "exp" )   { out = guard( std::exp( a ) );   return true; }
    if ( op == "log" )   { out = guard( std::log( a ) );   return true; }
    if ( op == "log10" ) { out = guard( std::log10( a ) ); return true; }
    if ( op == "log2" )  { out = guard( std::log2( a ) );  return true; }
    if ( op == "sin" )   { out = guard( std::sin( a ) );   return true; }
    if ( op == "cos" )   { out = guard( std::cos( a ) );   return true; }
    if ( op == "tan" )   { out = guard( std::tan( a ) );   return true; }
    if ( op == "asin" )  { out = guard( std::asin( a ) );  return true; }
    if ( op == "acos" )  { out = guard( std::acos( a ) );  return true; }
    if ( op == "atan" )  { out = guard( std::atan( a ) );  return true; }
    if ( op == "hypot" ) { out = guard( std::fabs( a ) );  return true; }   // hypot(a) == |a|
    if ( op == "sinh" )  { out = guard( std::sinh( a ) );  return true; }
    if ( op == "cosh" )  { out = guard( std::cosh( a ) );  return true; }
    if ( op == "tanh" )  { out = guard( std::tanh( a ) );  return true; }
    if ( op == "asinh" ) { out = guard( std::asinh( a ) ); return true; }
    if ( op == "acosh" ) { out = guard( std::acosh( a ) ); return true; }
    if ( op == "atanh" ) { out = guard( std::atanh( a ) ); return true; }

    // --- binary ---
    if ( op == "add" )   { out = a + b;            return true; }
    if ( op == "mult" )  { out = a * b;            return true; }
    if ( op == "atan2" ) { out = std::atan2( a, b ); return true; }
    if ( op == "mid" )   { out = ( a + b ) / 2;    return true; }
    if ( op == "min" )   { out = a < b ? a : b;    return true; }
    if ( op == "max" )   { out = a > b ? a : b;    return true; }
    if ( op == "or" )    { out = boolOf( a != 0 || b != 0 ); return true; }
    if ( op == "and" )   { out = boolOf( a != 0 && b != 0 ); return true; }
    if ( op == "xor" )   { out = boolOf( ( (long) a ^ (long) b ) != 0 ); return true; }
    if ( op == "eq" )    { out = boolOf( a == b ); return true; }
    if ( op == "ne" )    { out = boolOf( a != b ); return true; }
    if ( op == "lt" )    { out = boolOf( a < b );  return true; }
    if ( op == "gt" )    { out = boolOf( a > b );  return true; }
    if ( op == "le" )    { out = boolOf( a <= b ); return true; }
    if ( op == "ge" )    { out = boolOf( a >= b ); return true; }
    if ( op == "sub" )   { out = a - b;            return true; }
    if ( op == "div" )   { out = a / b;            return true; }
    if ( op == "pow" )   { out = std::pow( a, b ); return true; }
    if ( op == "mod" )   { out = std::fmod( a, b ); return true; }
    if ( op == "rsub" )  { out = b - a;            return true; }
    if ( op == "rdiv" )  { out = b / a;            return true; }
    if ( op == "rpow" )  { out = std::pow( b, a ); return true; }
    if ( op == "rmod" )  { out = std::fmod( b, a ); return true; }

    out = a;
    return false;   // unknown operator
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
    const String &op,
    ScaledNumber<Rep, Scale, Wide, FloatInterop> a,
    ScaledNumber<Rep, Scale, Wide, FloatInterop> b,
    ScaledNumber<Rep, Scale, Wide, FloatInterop> &out
  ) {
    using N = ScaledNumber<Rep, Scale, Wide, FloatInterop>;
    auto guard = [&]( N v ) -> N { return b == 0 ? v : a; };
    auto boolOf = [&]( bool v ) -> N { return v ? 1 : 0; };

    if ( op == "nop" )   { out = a; return true; }
    if ( op == "set" )   { out = b; return true; }
    if ( op == "bool" )  { out = boolOf( a != 0 ); return true; }
    if ( op == "clamp" ) { out = guard( a < 0 ? N( 0 ) : ( a > 1 ? N( 1 ) : a ) ); return true; }
    if ( op == "zero" )  { out = guard( 0 ); return true; }
    if ( op == "rand" )  {
      out = guard( N::fromRatio(
        static_cast<Wide>( std::rand() ),
        static_cast<Wide>( RAND_MAX ) + 1
      ) );
      return true;
    }

    if ( op == "dec" )   { out = guard( a - 1 ); return true; }
    if ( op == "inc" )   { out = guard( a + 1 ); return true; }
    if ( op == "neg" )   { out = guard( -a ); return true; }
    if ( op == "not" )   { out = guard( boolOf( a == 0 ) ); return true; }
    if ( op == "sqrt" )  {
      if ( b != 0 ) { out = a; return true; }
      if ( a < 0 ) return false;
      const std::uint64_t radicand =
        static_cast<std::uint64_t>( a.raw() )
        * static_cast<std::uint64_t>( Scale );
      out = N::fromRaw( static_cast<Wide>( operatorIntegerSqrt( radicand ) ) );
      return true;
    }
    if ( op == "inv" )   { out = guard( N( 1 ) / a ); return true; }
    if ( op == "abs" || op == "hypot" ) {
      out = guard( a < 0 ? -a : a );
      return true;
    }
    if ( op == "floor" ) { out = guard( NumberOps<N>::floor( a ) ); return true; }
    if ( op == "trunc" ) { out = guard( N( static_cast<long>( a ) ) ); return true; }
    if ( op == "ceil" )  {
      N floor = NumberOps<N>::floor( a );
      out = guard( a == floor ? floor : floor + 1 );
      return true;
    }
    if ( op == "round" ) {
      const Wide raw = static_cast<Wide>( a.raw() );
      const Wide half = static_cast<Wide>( Scale / 2 );
      const Wide units = raw < 0
        ? ( raw - half ) / static_cast<Wide>( Scale )
        : ( raw + half ) / static_cast<Wide>( Scale );
      out = guard( N( units ) );
      return true;
    }
    if ( op == "sign" )  { out = guard( N( ( a > 0 ) - ( a < 0 ) ) ); return true; }

    if ( op == "add" )   { out = a + b; return true; }
    if ( op == "mult" )  { out = a * b; return true; }
    if ( op == "mid" )   { out = ( a + b ) / 2; return true; }
    if ( op == "min" )   { out = a < b ? a : b; return true; }
    if ( op == "max" )   { out = a > b ? a : b; return true; }
    if ( op == "or" )    { out = boolOf( a != 0 || b != 0 ); return true; }
    if ( op == "and" )   { out = boolOf( a != 0 && b != 0 ); return true; }
    if ( op == "xor" )   {
      out = boolOf( ( static_cast<long>( a ) ^ static_cast<long>( b ) ) != 0 );
      return true;
    }
    if ( op == "eq" )    { out = boolOf( a == b ); return true; }
    if ( op == "ne" )    { out = boolOf( a != b ); return true; }
    if ( op == "lt" )    { out = boolOf( a < b ); return true; }
    if ( op == "gt" )    { out = boolOf( a > b ); return true; }
    if ( op == "le" )    { out = boolOf( a <= b ); return true; }
    if ( op == "ge" )    { out = boolOf( a >= b ); return true; }
    if ( op == "sub" )   { out = a - b; return true; }
    if ( op == "div" )   { out = a / b; return true; }
    if ( op == "mod" )   {
      if ( b.raw() == 0 ) return false;
      out = N::fromRaw( static_cast<Wide>( a.raw() ) % static_cast<Wide>( b.raw() ) );
      return true;
    }
    if ( op == "rsub" )  { out = b - a; return true; }
    if ( op == "rdiv" )  { out = b / a; return true; }
    if ( op == "rmod" )  {
      if ( a.raw() == 0 ) return false;
      out = N::fromRaw( static_cast<Wide>( b.raw() ) % static_cast<Wide>( a.raw() ) );
      return true;
    }

    // exp/log/trig/hyperbolic/pow/atan2 await integer kernels.
    out = a;
    return false;
  }
}
