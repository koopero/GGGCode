#pragma once
#include "./types.hpp"
#include "./debug.hpp"

namespace grizzlar { 
  namespace impl {

    types::buffer_index_t dimIndex( const types::ivec4 &dim, types::buffer_index_t x = 0 );
    types::buffer_index_t dimIndex( const types::ivec4 &dim, types::float_t x = 0 );
    types::buffer_index_t dimIndex( const types::ivec4 &dim, types::ivec1 x  );
    types::buffer_index_t dimIndex( const types::ivec4 &dim, types::ivec2 pos );
    types::buffer_index_t dimIndex( const types::ivec4 &dim, types::ivec3 pos );
    types::buffer_index_t dimIndex( const types::ivec4 &dim, types::ivec4 pos );

    class Dimensioned {
    public:
      types::ivec4 dim;
      types::dim_t scalarSize = 0;

      types::buffer_index_t sizeBytes() const;
      types::buffer_index_t sizeScalar() const;
      types::buffer_index_t sizeVec() const;
      types::ivec3 dimVec() const;

      types::buffer_index_t dimIndex( types::buffer_index_t x ) const {
        return x * dim.w;
      }

      types::buffer_index_t dimIndex( types::float_t x ) const {
        return dimIndex( (types::buffer_index_t) x );
      }

      types::buffer_index_t dimIndex( types::ivec1 x ) const {
        return x * dim.w;
      }
      types::buffer_index_t dimIndex( types::ivec2 xy ) const {
        return dimIndex( xy.x + ( dim.x * xy.y ) );
      }
      types::buffer_index_t dimIndex( types::ivec3 xyz ) const {
        return dimIndex( xyz.x + ( dim.x * xyz.y ) + ( dim.y * dim.x * xyz.z ) );
      }

    };

    class BufferBase : public Dimensioned {
    public:
      void * ptr = nullptr;
      types::change_index_t changeIndex = 0;

      virtual bool allocate();
      virtual ~BufferBase() {};

      void mapTo( types::norm_t * newPtr, types::int_t offset  ) {
        ptr = &(newPtr[offset]);
      };

      void setChanged() {
        changeIndex++;
      }

      template <typename RT>
      inline RT readScalar( types::buffer_index_t index = 0, RT value = 0. ) const {
        if ( index < sizeScalar() && index >= 0 ) {
          switch( scalarSize ) {
            case sizeof(types::norm_t):
              value = ((types::norm_t*) ptr )[index];
            break;

            case sizeof(types::float_t):
              value = ((types::float_t*) ptr )[index];
            break;
          }
        }
        return value;
      };

      template <typename RT>
      inline void writeScalar( RT value, types::buffer_index_t index = 0. ) {
        if ( index < sizeScalar() && index >= 0 ) {
          switch( scalarSize ) {
            case sizeof(types::norm_t): {
              types::norm_t next_byte = value;
            
              if ( next_byte != (((types::norm_t*) ptr )[index]) ) {
                setChanged();
              } 
            
              ((types::norm_t*) ptr )[index] = next_byte;
            } break;

            case sizeof(types::float_t): {
              types::float_t next_float = value;
            
              if ( next_float != (((types::float_t*) ptr )[index]) ) {
                setChanged();
              } 
            
              ((types::float_t*) ptr )[index] = next_float;
            } break;
          }
        }
      };

      template <typename VT>
      inline void writeVec( VT value, types::buffer_index_t index = 0 ) {
        if ( index < sizeVec() && index >= 0 ) {
          for ( types::buffer_index_t vecIndex = 0; vecIndex < VT::num_of_components && vecIndex < dim.w; vecIndex++ ) {
            writeScalar( value[vecIndex], index * dim.w + vecIndex );
          }
        }
      };

      void writeVec( types::float_t value, types::buffer_index_t index = 0. ) {
        if ( index < sizeVec() && index >= 0 ) {
          writeScalar( value, index * dim.w );
        }
      };
    };

    template <typename BT>
    class BufferRead : virtual public BufferBase {
    public:
      // inline RT readScalar( types::buffer_index_t index = 0., RT value = 0. ) const;
      template <typename RT>
      RT readScalar( types::buffer_index_t index = 0, RT value = 0. ) const;

      types::float_t readFloat( types::buffer_index_t index = 0, types::float_t value = 0. ) const {
        return readScalar<types::float_t>( index, value );
      };

      types::norm_t readIndexByte( types::buffer_index_t index = 0, types::norm_t value = 0. ) const {
        return readScalar<types::norm_t>( index, value );
      };

      template <typename IT>
      types::norm_t readByte( IT pos = 0, types::norm_t value = 0. ) const {
        types::buffer_index_t index = dimIndex( pos );
        return readIndexByte( index, value );
      }      
      
      template <typename VT>
      VT readIndexVec( types::buffer_index_t index = 0, VT value = VT(0.) ) const {
        for ( types::buffer_index_t vecIndex = 0; vecIndex < VT::num_of_components && vecIndex < dim.w; vecIndex++ ) {
          value[vecIndex] = readScalar( index + vecIndex, value[vecIndex] );
        }
        return value;      
      }

      float_t readIndexVec( types::buffer_index_t index = 0, float_t value = 0. ) const {
        value = readScalar( index, value );
        return value;      
      }

      template <typename VT, typename IT>
      VT readVec( IT pos = 0, VT value = VT(0.) ) const {
        types::buffer_index_t index = dimIndex( pos );
        return readIndexVec( index, value );      
      }

      template <typename IT>
      types::float_t readVec( IT pos = 0, types::float_t value = 0. ) const {
        types::buffer_index_t index = dimIndex( pos );
        return readIndexVec( index, value );         
      }

      template <typename IT>
      types::vec4 readVec1( IT pos, types::vec1 value = types::vec1(0.) ) const {  return readVec( pos, value ); }

      template <typename IT>
      types::vec4 readVec2( IT pos, types::vec4 value = types::vec2(0.) ) const {  return readVec( pos, value ); }

      template <typename IT>
      types::vec4 readVec3( IT pos, types::vec4 value = types::vec3(0.) ) const {  return readVec( pos, value ); }

      template <typename IT>
      types::vec4 readVec4( IT pos, types::vec4 value = types::vec4(0.) ) const {  return readVec( pos, value ); }

    };

    template <typename BT, bool WATCH> 
    class Buffer : virtual public BufferRead<BT>, virtual public BufferBase {
    public:
      Buffer( 
        types::dim_t d0, 
        types::dim_t d1, 
        types::dim_t d2, 
        types::dim_t d3,
        BT* initPtr = nullptr 
      ) {
        BufferBase::scalarSize = sizeof( BT );
        BufferBase::dim.w = d0;
        BufferBase::dim.x = d1;
        BufferBase::dim.y = d2;
        BufferBase::dim.z = d3;
        BufferBase::ptr = initPtr;
      }

      bool allocate( BT * setPtr ) {
        if ( ptr ) {
          debug::fail("Will not reset ptr");
          return false;
        } else {
          BufferBase::ptr = setPtr;
          return true;
        }
      }

      bool allocate() {
        if ( !BufferBase::ptr ) {
          debug::trace("allocate", BufferBase::sizeBytes() );
          BufferBase::ptr = calloc( BufferBase::sizeBytes(), 1 );
          return !!BufferBase::ptr;
        } else {
          return true;
        }
      }


      template <typename WT>
      void writeScalar( WT value, types::buffer_index_t index = 0 ) {
        if ( index < sizeScalar() && index >= 0 ) {
          BT comp = value;
          if ( WATCH ) {
            if ( comp != (((BT*) ptr )[index]) ) {
              setChanged();
            }
          } 
            
          ((BT*) ptr )[index] = comp;
        }
      };



      template <typename VT>
      void writeIndexVec( VT value, types::buffer_index_t index = 0 ) {
        if ( index < 0 ) return;

        for ( types::buffer_index_t vecIndex = 0; vecIndex < VT::num_of_components && vecIndex < dim.w; vecIndex++ ) {
          if ( index >= sizeScalar() ) {
            break;
          }

          // Serial.print( "writeIndexVec: " );
          // Serial.println( index );

          BT comp = value[vecIndex];
          // Serial.print( "writeIndexVec2: " );
          // Serial.print( (uint32_t)(ptr) );
          // Serial.print( ", " );
          // Serial.print( sizeScalar() );
          // Serial.print( ", " );
          // Serial.println( comp );

          if ( WATCH ) {
            if ( comp != (((BT*) ptr )[index]) ) {
              setChanged();
            }
          } 
          
          ((BT*) ptr )[index] = comp;
          index++;
        }
      };

      void writeIndexVec( float_t value, types::buffer_index_t index = 0 ) {
        if ( index < 0 || index >= sizeScalar() ) {
          return;
        }
        
        if ( WATCH ) {
          if ( value != float_t(((BT*) ptr )[index]) ) {
            setChanged();
          }
        } 
        
        ((BT*) ptr )[index] = value;
      };

      template <typename VT, typename IT>
      void writeVec( VT value, IT index = 0 ) {
        uint32_t pos = dimIndex( index );
        writeIndexVec( value, pos );
      };
    };
  };
};