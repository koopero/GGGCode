#pragma once

#include "./Types.h"
#include <cmath>
#include "./autogen.h"
#include "./ggg/NumberOps.h"

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
    return NumberOps<NumberType>::format( number );
  }
}; // namespace ggg