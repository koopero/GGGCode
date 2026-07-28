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
      if ( c == Quote || c == Escape ) {
        result += "\\";
      }
      result += c;
    }
    result += Quote;
    return result;
  }

  // N is deduced from the argument, so call sites are unchanged.
  template <typename N>
  inline String FormatNumber( const N &number ) {
    return NumberOps<N>::format( number );
  }
}; // namespace ggg
