#pragma once

#include "./Types.h"
#include "./autogen.h"

namespace ggg {
  inline String FormatString( const String &string ) {
    String result;
    result += Quote;
    for ( auto c : string ) {
      if ( c == Quote ) {
        result += "\\";
        result += Quote;
      } else {
        result += c;
      }
    }
    result += Quote;
    return result;
  }

  inline String FormatNumber( const NumberType &number ) {
    std::ostringstream oss;
    // Negative zero renders as "0", not "-0". The reference stringifies numbers
    // with JavaScript's Number->String, which does not sign zero, and -0 reaches
    // here from ordinary parses ("-0x10" ends its number at the "x", leaving -0).
    oss << ( number == 0 ? (NumberType) 0 : number );
    return oss.str();
  }
}; // namespace ggg