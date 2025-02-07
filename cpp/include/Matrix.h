#pragma once
#include <vector>
#include "./Types.h"
#include "./Dim.h"

namespace ggg {
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

    constexpr Index index( const Index & _index ) {
      return _index;
    }

    constexpr Index index( const DimType &_dim ) {
      return DimIndex( dim, _dim );
    }

    constexpr Index index( const std::initializer_list<int> & index ) {
      return DimIndex( dim, index );
    }

    template <typename Lookup>
    constexpr NumberType readNumber( const Lookup &coord, NumberType defaultValue = 0. ) {
      return readNumber( index(coord), defaultValue );
    }

    constexpr NumberType readNumber( const Index & index, NumberType defaultValue = 0. ) {
      if ( index < 0 || index >= size ) return defaultValue;
      return data[index];
    }

    constexpr NumberType readNumber( const DimType & coord, NumberType defaultValue = 0. ) {
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
    Index write( const Write & value, const Index & ind = 0 ) {
      if ( ind < 0 || ind >= size ) return 0;
      data[ind] = value;
      return 1;
    }

    template <typename Write>
    Index write( Write value, const DimType & coord ) {
      return write( value, index(coord) );
    }

    template <typename Write>
    Index write(std::initializer_list<Write> values, Index ind = 0 ) {
      Index wrote = 0;
      for ( Write value : values ) {
        if ( ind < 0 || ind >= size ) break;
        data[ind] = value;
        wrote++;
        ind++;
      }
      return wrote;
    };

    template <typename Write>
    Index write( std::initializer_list<Write> values, const DimType & coord ) {
      return write( values, index(coord) );
    }


    template <typename Write>
    Index write( const Write * source, const Index &count, const Index & index = 0 ) {
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
  };
}; // namespace ggg