#pragma once
#include <vector>
#include "./Types.h"

typedef std::vector<gggIndex> DimType;

template <typename Storage,bool Watch>
class MatrixStatic {
public :
  DimType dim;
  gggIndex size;
  Storage * data = nullptr;
  MatrixStatic( DimType _dim, Storage * _data = nullptr ) : dim(_dim) {
    size = 1;
    for ( gggIndex d = 0; d < dim.size(); d++ ) {
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

  constexpr gggIndex index( const DimType &_dim ) {
    gggIndex i = 0;
    gggIndex j = 1;
    for ( gggIndex d = 0; d < dim.size(); d++ ) {
      i += j * _dim[d];
      j *= dim[d];
    }
    return i;
  }

  Storage& operator[]( DimType _dim ) {
    return data[index(_dim)];
  }

  gggNumber readNumber( const gggIndex & index, gggNumber defaultValue = 0. ) {
    if ( index < 0 || index >= size ) return defaultValue;
    return data[index];
  }

  template <typename Lookup>
  gggNumber readNumber( const Lookup &coord, gggNumber defaultValue = 0. ) {
    return readNumber( index(coord), defaultValue );
  }

  template <typename Read>
  gggIndex read( const gggIndex & index, Read * dest, gggIndex count ) {
    gggIndex last = index + count;
    gggIndex result = 0;
    for ( gggIndex i = index; i < last && i < size; i++ ) {
      dest[i] = data[index + i];
      result++;
    }
    return result;
  }

  template <typename Lookup, typename Read>
  gggIndex read( const Lookup &coord, Read * dest, gggIndex count ) {
    return read( index(coord), dest, count );
  }

  template <typename Write>
  gggIndex write( const gggIndex & index, const Write * source, gggIndex count ) {
    gggIndex last = index + count;
    gggIndex result = 0;

    if ( !WATCH ) {
      for ( gggIndex i = index; i < last && i < size; i++ ) {
        data[index + i] = source[i];
        result++;
      }
    } else {

    }
    return result;
  }

  template <typename Write>
  gggIndex writeNumber( const DimType &coord, const Write & value ) {
    return write( index(coord), &value, 1 );
  }
};