#pragma once

#include "./Types.h"
#include "./autogen.h"

gggString FormatString( const gggString &string ) {
  gggString result;
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

gggString FormatNumber( const gggNumber &number ) {
  std::ostringstream oss;
  oss << number;
  return oss.str();
}