#pragma once

#include <cmath>
#include <cstdlib>
#include "./Types.h"

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
}
