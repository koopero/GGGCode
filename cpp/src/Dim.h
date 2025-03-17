#pragma once

#include "./Types.h"

typedef std::vector<gggIndex> DimType;

constexpr gggIndex DimIndex( const DimType &dim, const DimType &index ) {
  gggIndex i = 0;
  gggIndex j = 1;
  for ( gggIndex d = 0; d < dim.size(); d++ ) {
    i += j * index[d];
    j *= dim[d];
  }
  return i;
};

constexpr gggIndex DimIndex( const DimType &dim, const gggIndex &index ) {
  return index;
};

constexpr gggIndex DimSize( const DimType &dim ) {
  gggIndex size = 1;
  for ( gggIndex d = 0; d < dim.size(); d++ ) {
    size *= dim[d];
  }
  return size;
};
