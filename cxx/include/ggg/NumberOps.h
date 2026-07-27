#pragma once

#include <cmath>
#include <cstdlib>
#include <cstdint>
#include <limits>
#include <sstream>
#include "../Types.h"
#include "./ScaledNumber.h"

namespace ggg {
  //
  // The numeric customization point. Everything the machine needs from its
  // NumberType that plain arithmetic and comparison cannot express lives here,
  // so substituting the type is a matter of specializing this template rather
  // than editing the parser.
  //
  // The primary template is the IEEE floating-point implementation (float,
  // double). ScaledNumber has the integer-only partial specialization below;
  // other numeric types can provide their own specialization.
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

    static N pi()    { return (N) 3.141592653589793; }
    static N tau()   { return (N) 6.283185307179586; }
    static N phi()   { return (N) 1.618033988749895; }
    static N gamma() { return (N) 0.5772156649; }

    static N ratio( long numerator, long denominator ) {
      return (N) numerator / (N) denominator;
    }

    static N floor( N value ) { return std::floor( value ); }
    static N floorCoordinate( N value ) { return std::floor( value ); }
    static N coordinateEpsilon() { return N( 0 ); }
    static N abs( N value ) { return std::fabs( value ); }
    static N epsilon() { return std::numeric_limits<N>::epsilon(); }

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

  //
  // Integer-only implementation for every ScaledNumber format. Parsing and
  // rendering operate directly on decimal digits; no strtod, stream insertion,
  // or floating-point conversion is instantiated.
  //
  template <typename Rep, std::int64_t Scale, typename Wide, bool FloatInterop>
  struct NumberOps<ScaledNumber<Rep, Scale, Wide, FloatInterop>> {
    using N = ScaledNumber<Rep, Scale, Wide, FloatInterop>;

    static N infinity() { return N::max(); }

    // Reserve +/- the positive raw endpoint for the language's infinity unitary.
    // Blankness has its own flags, so no other sentinel is needed.
    static bool isInfinite( N value ) {
      const Rep raw = value.raw();
      const Rep max = std::numeric_limits<Rep>::max();
      return raw == max
        || ( std::numeric_limits<Rep>::is_signed
          && raw == static_cast<Rep>( -static_cast<Wide>( max ) ) );
    }

    static N parseLiteral( const char *literal ) {
      char *end = nullptr;
      return parse( literal, &end );
    }

    static N pi()    { return parseLiteral( "3.141592653589793" ); }
    static N tau()   { return parseLiteral( "6.283185307179586" ); }
    static N phi()   { return parseLiteral( "1.618033988749895" ); }
    static N gamma() { return parseLiteral( "0.5772156649" ); }

    static N ratio( long numerator, long denominator ) {
      return N::fromRatio( static_cast<Wide>( numerator ), static_cast<Wide>( denominator ) );
    }

    static N floor( N value ) {
      Wide whole = static_cast<Wide>( value.raw() ) / static_cast<Wide>( Scale );
      if ( value.raw() < 0
        && static_cast<Wide>( value.raw() ) % static_cast<Wide>( Scale ) != 0 )
        whole--;
      return N( whole );
    }

    // Fixed transforms can land one raw unit below an exact pixel boundary
    // (1/3 * 3, for example). Snap that representational residue before an
    // index floor; ordinary arithmetic floor remains exact and unsnapped.
    static N floorCoordinate( N value ) {
      // A normalized coordinate may be divided and then multiplied by its
      // dimension, accumulating a handful of one-raw-unit truncations.
      return floor( value + coordinateEpsilon() );
    }
    static N coordinateEpsilon() { return N::fromRaw( 4 ); }

    static N abs( N value ) { return value < 0 ? -value : value; }
    static N epsilon() { return N::fromRaw( 1 ); }

    static N parse( const char *begin, char **end ) {
      const char *p = begin;
      while ( *p == ' ' || *p == '\t' || *p == '\n' || *p == '\r' ) p++;

      bool negative = false;
      if ( *p == '+' || *p == '-' ) {
        negative = *p == '-';
        p++;
      }

      String digits;
      int digitsBeforePoint = 0;
      while ( *p >= '0' && *p <= '9' ) {
        digits += *p++;
        digitsBeforePoint++;
      }

      if ( *p == '.' ) {
        const char *dot = p++;
        while ( *p >= '0' && *p <= '9' ) digits += *p++;
        if ( digits.empty() ) {
          if ( end ) *end = const_cast<char *>( begin );
          return N();
        }
        (void) dot;
      } else if ( digits.empty() ) {
        if ( end ) *end = const_cast<char *>( begin );
        return N();
      }

      int exponent = 0;
      const char *validEnd = p;
      if ( *p == 'e' || *p == 'E' ) {
        const char *expMark = p++;
        bool expNegative = false;
        if ( *p == '+' || *p == '-' ) {
          expNegative = *p == '-';
          p++;
        }
        if ( *p >= '0' && *p <= '9' ) {
          while ( *p >= '0' && *p <= '9' ) {
            if ( exponent < 1000 ) exponent = exponent * 10 + ( *p - '0' );
            p++;
          }
          if ( expNegative ) exponent = -exponent;
          validEnd = p;
        } else {
          validEnd = expMark; // incomplete exponent: keep the prefix before "e"
        }
      }
      if ( end ) *end = const_cast<char *>( validEnd );

      const int decimalPoint = digitsBeforePoint + exponent;
      const std::uint64_t positiveLimit =
        static_cast<std::uint64_t>( std::numeric_limits<Rep>::max() );
      const std::uint64_t negativeLimit = std::numeric_limits<Rep>::is_signed
        ? static_cast<std::uint64_t>(
            -( static_cast<std::int64_t>( std::numeric_limits<Rep>::lowest() ) + 1 )
          ) + 1
        : 0;
      const std::uint64_t limit = negative ? negativeLimit : positiveLimit;
      std::uint64_t raw = 0;

      // Integral decimal digits, including exponent-introduced trailing zeroes.
      for ( int i = 0; i < decimalPoint; i++ ) {
        const unsigned digit = i < static_cast<int>( digits.size() )
          ? static_cast<unsigned>( digits[(size_t) i] - '0' )
          : 0;
        const std::uint64_t add = static_cast<std::uint64_t>( digit )
          * static_cast<std::uint64_t>( Scale );
        if ( raw > limit / 10
          || raw * 10 > limit
          || add > limit - raw * 10 ) {
          raw = limit;
          break;
        }
        raw = raw * 10 + add;
      }

      // At Q16 precision, nine decimal places are already far below one raw
      // unit. Keeping the conversion bounded also makes arbitrarily long input
      // harmless on a microcontroller.
      const int fractionalDigits = decimalPoint < static_cast<int>( digits.size() )
        ? static_cast<int>( digits.size() ) - decimalPoint
        : 0;
      std::uint64_t fraction = 0;
      std::uint64_t denominator = 1;
      const int kept = fractionalDigits > 9 ? 9 : fractionalDigits;
      for ( int i = 0; i < kept; i++ ) {
        const int digitIndex = decimalPoint + i;
        const unsigned digit = digitIndex >= 0
          && digitIndex < static_cast<int>( digits.size() )
          ? static_cast<unsigned>( digits[(size_t) digitIndex] - '0' )
          : 0;
        fraction = fraction * 10 + digit;
        denominator *= 10;
      }
      if ( fraction && raw < limit ) {
        const std::uint64_t fractionRaw =
          ( fraction * static_cast<std::uint64_t>( Scale ) + denominator / 2 )
          / denominator;
        raw = fractionRaw > limit - raw ? limit : raw + fractionRaw;
      }

      if ( negative ) {
        if ( raw >= negativeLimit )
          return N::fromRaw( static_cast<Wide>( std::numeric_limits<Rep>::lowest() ) );
        return N::fromRaw( -static_cast<Wide>( raw ) );
      }
      return N::fromRaw( static_cast<Wide>( raw ) );
    }

    static String format( N value ) {
      if ( isInfinite( value ) )
        return value.raw() < 0 ? "-Infinity" : "Infinity";

      const Wide signedRaw = static_cast<Wide>( value.raw() );
      const bool negative = signedRaw < 0;
      const std::uint64_t magnitude = negative
        ? static_cast<std::uint64_t>( -( signedRaw + 1 ) ) + 1
        : static_cast<std::uint64_t>( signedRaw );
      const std::uint64_t denominator = static_cast<std::uint64_t>( Scale );
      const std::uint64_t whole = magnitude / denominator;
      std::uint64_t remainder = magnitude % denominator;

      String out = std::to_string( whole );
      if ( remainder ) {
        out += '.';
        for ( int digit = 0; remainder && digit < 16; digit++ ) {
          remainder *= 10;
          out += static_cast<char>( '0' + remainder / denominator );
          remainder %= denominator;
        }
        while ( out.back() == '0' ) out.pop_back();
        if ( out.back() == '.' ) out.pop_back();
      }
      if ( negative && magnitude ) out.insert( out.begin(), '-' );
      return out;
    }
  };
}; // namespace ggg
