#pragma once
#include <cstdint>
#include <vector>
#include "./Types.h"
#include "./Dim.h"
#include "./List.h"

namespace ggg {

  // Type-erased, non-template base shared by every matrix. This is the handle
  // the register table / command layer holds (it can read/write any matrix as
  // the configured Number without knowing its Storage type), and the seam that grizzlar's
  // buffers plug into (directly, once the header merge lands; via an adapter
  // until then). It is a ListItem so it can live in a List<MatrixBase> register
  // table, addressed by index (R) or name (L).
  template <class T = DefaultTraits>
  class MatrixBaseT : public ListItem {
  public:
    using Number = typename T::Number;

    DimType dim;
    Index size = 0;           // total scalar count
    Index scalarSize = 0;     // bytes per scalar element
    uint32_t changeIndex = 0; // bumped on every mutation; drives watch/dirty

    virtual ~MatrixBaseT() {}

    void setChanged() { changeIndex++; }

    Index sizeScalar() const { return size; }
    Index sizeBytes() const { return size * scalarSize; }
    Index components() const { return dim.size() > 0 ? dim[0] : 1; }
    Index sizeVec() const { Index c = components(); return c ? size / c : size; }

    // Type-erased scalar access through the configured language Number.
    // Concrete Matrix overrides these against its typed storage. The historical
    // method names remain for source compatibility.
    virtual Number readScalarFloat( Index index, Number defaultValue = 0 ) const { return defaultValue; }
    // Read-or-fail: false when the index is out of range (or there is no
    // storage), rather than signalling it with an out-of-band value. Callers
    // that need to tell "absent" from "read a 0" use this one.
    virtual bool readScalarChecked( Index index, Number &out ) const { return false; }
    virtual void writeScalarFloat( Number value, Index index ) {}
    virtual bool allocate() { return false; }
  };
  using MatrixBase = MatrixBaseT<>;

  template <typename Storage, bool Watch, class T = DefaultTraits>
  class Matrix : public MatrixBaseT<T> {
    using Base = MatrixBaseT<T>;
  public :
    using Number = typename T::Number;
    // The dependent base's members are not visible unqualified without these.
    using Base::dim;
    using Base::size;
    using Base::scalarSize;
    using Base::setChanged;

    Storage * data = nullptr;

    Matrix( DimType _dim, Storage * _data = nullptr ) {
      dim = _dim;
      size = 1;
      for ( Index d = 0; d < dim.size(); d++ ) {
        size *= dim[d];
      }
      scalarSize = sizeof( Storage );
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

    bool allocate() override {
      if ( !data) {
        data = (Storage*) calloc( size, sizeof( Storage ) );
        return !!data;
      } else {
        return true;
      }
    }

    // Type-erased overrides (MatrixBase) -- used by the register/command layer.
    Number readScalarFloat( Index index, Number defaultValue = 0 ) const override {
      if ( index < 0 || index >= size || !data ) return defaultValue;
      return (Number) data[index];
    }

    bool readScalarChecked( Index index, Number &out ) const override {
      if ( index < 0 || index >= size || !data ) return false;
      out = (Number) data[index];
      return true;
    }

    void writeScalarFloat( Number value, Index index ) override {
      if ( index < 0 || index >= size || !data ) return;
      Storage next = value;
      if ( Watch ) {
        if ( !( data[index] == next ) ) setChanged();
      }
      data[index] = next;
    }

    Index index( const Index & _index ) {
      return _index;
    }

    Index index( const DimType &_dim ) {
      return DimIndex( dim, _dim );
    }

    Index index( const std::initializer_list<int> & index ) {
      return DimIndex( dim, index );
    }

    template <typename Lookup>
    Number readNumber( const Lookup &coord, Number defaultValue = 0 ) {
      return readNumber( index(coord), defaultValue );
    }

    Number readNumber( const Index & index, Number defaultValue = 0 ) {
      if ( index < 0 || index >= size ) return defaultValue;
      return data[index];
    }

    Number readNumber( const DimType & coord, Number defaultValue = 0 ) {
      return readNumber( index(coord), defaultValue );
    }

    template <typename Read>
    Index read( const Index & index, Read * dest, Index count ) {
      Index result = 0;
      for ( Index k = 0; k < count && ( index + k ) < size; k++ ) {
        dest[k] = data[index + k];
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
      if ( Watch ) setChanged();
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
      if ( Watch && wrote ) setChanged();
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

      for ( Index i = index; i < last && i < size; i++ ) {
        data[i] = source[i - index];
        result++;
      }
      if ( Watch && result ) setChanged();
      return result;
    }
  };

  // Backwards-compatible alias: MatrixStatic was the pre-merge name.
  template <typename Storage, bool Watch, class T = DefaultTraits>
  using MatrixStatic = Matrix<Storage, Watch, T>;

}; // namespace ggg
