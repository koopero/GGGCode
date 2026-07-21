#pragma once

#include <cmath>
#include <cstdlib>
#include <sstream>
#include "../Types.h"

namespace ggg {
  //
  // The numeric customization point. Everything the machine needs from its
  // NumberType that plain arithmetic and comparison cannot express lives here,
  // so substituting the type is a matter of specializing this template rather
  // than editing the parser.
  //
  // The primary template is the IEEE floating-point implementation (float,
  // double). A type without IEEE semantics -- a fixed-point NormalizedNumber,
  // say -- specializes it:
  //
  //   template <> struct NumberOps<Norm16> {
  //     static Norm16 infinity() { return Norm16::max(); }   // saturate
  //     ...
  //   };
  //
  // Being a template, the primary is only instantiated for the types actually
  // used, so its std::isinf / strtod bodies never have to compile against a
  // type that cannot support them.
  //
  // Note what is NOT here: there is no blank() / isBlank(). "Not written by the
  // parser" is carried by explicit flags (see RangeAxis in Solve.h), not by a
  // sentinel value, so a NumberType needs no spare representation to donate.
  //
  template <typename N>
  struct NumberOps {
    // The value of the ∞ unitary.
    static N infinity() { return (N) INFINITY; }

    static bool isInfinite( N value ) { return std::isinf( value ); }

    // Parse the longest valid numeric PREFIX of `begin`, setting `*end` to the
    // first character not consumed -- strtod's contract. `*end == begin` means
    // nothing parsed, which is how both numeric entry points (finishNumber and
    // parseSubscriptSegments) tell a number from a stray sign.
    static N parse( const char * begin, char ** end ) {
      return (N) strtod( begin, end );
    }

    // Render for the wire. The reference stringifies with JavaScript's
    // Number->String, so an infinite value is "Infinity", not the C++ stream's
    // "inf", and zero is never signed -- -0 reaches here from ordinary parses
    // ("-0x10" ends its number at the "x", leaving -0).
    static String format( N value ) {
      if ( isInfinite( value ) ) return value < 0 ? "-Infinity" : "Infinity";
      std::ostringstream oss;
      oss << ( value == 0 ? (N) 0 : value );
      return oss.str();
    }
  };
}; // namespace ggg
