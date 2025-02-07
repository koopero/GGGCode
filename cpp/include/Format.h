#pragma once

#include "./Types.h"
#include "./autogen.h"

namespace ggg {
  String FormatString( const String &string ) {
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

  String FormatNumber( const NumberType &number ) {
    std::ostringstream oss;
    oss << number;
    return oss.str();
  }
}; // namespace ggg