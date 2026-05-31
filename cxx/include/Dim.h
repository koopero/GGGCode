#pragma once

#include "./Types.h"

namespace ggg {
  typedef std::vector<Index> DimType;
  
  inline Index DimIndex( const DimType &dim, const DimType &index ) {
    Index i = 0;
    Index j = 1;
    for ( Index d = 0; d < dim.size(); d++ ) {
      i += j * index[d];
      j *= dim[d];
    }
    return i;
  };

  inline Index DimIndex( const DimType &dim, const std::initializer_list<int> &coord ) {
    Index i = 0;
    Index j = 1;
    Index axis = 0;
    for ( int c : coord ) {
      i += j * c;
      if ( axis < (Index) dim.size() ) j *= dim[axis];
      axis++;
    }
    return i;
  };


  inline Index DimIndex( const DimType &dim, const Index &index ) {
    return index;
  };

  inline Index DimSize( const DimType &dim ) {
    Index size = 1;
    for ( Index d = 0; d < dim.size(); d++ ) {
      size *= dim[d];
    }
    return size;
  };
}; // namespace ggg