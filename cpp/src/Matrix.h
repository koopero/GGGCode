#pragma once
#include <vector>
#include "./Types.h"
#include "./Dim.h"


template <typename Storage,bool Watch>
class MatrixStatic {
public :
  DimType dim;
  Index size;
  Storage * data = nullptr;

  MatrixStatic( DimType _dim, Storage * _data = nullptr ) : dim(_dim) {
    size = 1;
    for ( Index d = 0; d < dim.size(); d++ ) {
      size *= dim[d];
    }
    data = _data;
  }

  bool allocate( Storage * setPtr ) {
    if ( data ) {
      return false;
    } else {
      data = setPtr;
      return true;
    }
  }

  bool allocate() {
    if ( !data) {
      data = (Storage*) calloc( size, sizeof( Storage ) );
      return !!data;
    } else {
      return true;
    }
  }

  constexpr Index index( const DimType &_dim ) {
    return DimIndex( dim, _dim );
  }

  template <typename Lookup>
  constexpr gggNumber readNumber( const Lookup &coord, gggNumber defaultValue = 0. ) {
    return readNumber( index(coord), defaultValue );
  }

  constexpr gggNumber readNumber( const Index & index, gggNumber defaultValue = 0. ) {
    if ( index < 0 || index >= size ) return defaultValue;
    return data[index];
  }

  constexpr gggNumber readNumber( const DimType & coord, gggNumber defaultValue = 0. ) {
    return readNumber( index(coord), defaultValue );
  }

  template <typename Read>
  Index read( const Index & index, Read * dest, Index count ) {
    Index last = index + count;
    Index result = 0;
    for ( Index i = index; i < last && i < size; i++ ) {
      dest[i] = data[index + i];
      result++;
    }
    return result;
  }

  template <typename Lookup, typename Read>
  Index read( const Lookup &coord, Read * dest, Index count ) {
    return read( index(coord), dest, count );
  }

  template <typename Write>
  Index write( const Index & index, const Write * source, Index count ) {
    Index last = index + count;
    Index result = 0;

    if ( !Watch ) {
      for ( Index i = index; i < last && i < size; i++ ) {
        data[index + i] = source[i];
        result++;
      }
    } else {

    }
    return result;
  }

  template <typename Write>
  Index writeNumber( const DimType &coord, const Write & value ) {
    return write( index(coord), &value, 1 );
  }
};