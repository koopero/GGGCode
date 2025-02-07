#pragma once

#include "./Types.h"

namespace ggg {
  typedef std::vector<Index> DimType;
  
  constexpr Index DimIndex( const DimType &dim, const DimType &index ) {
    Index i = 0;
    Index j = 1;
    for ( Index d = 0; d < dim.size(); d++ ) {
      i += j * index[d];
      j *= dim[d];
    }
    return i;
  };

  constexpr Index DimIndex( const DimType &dim, const std::initializer_list<int> &coord ) {
    Index i = 0;
    Index j = 1;
    for ( int d : coord ) {
      i += j * d;
      j *= dim[d];
    }
    return i;
  };


  constexpr Index DimIndex( const DimType &dim, const Index &index ) {
    return index;
  };

  constexpr Index DimSize( const DimType &dim ) {
    Index size = 1;
    for ( Index d = 0; d < dim.size(); d++ ) {
      size *= dim[d];
    }
    return size;
  };
}; // namespace ggg