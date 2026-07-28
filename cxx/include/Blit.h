#pragma once
#include "./Config.h"
#if GGGGX_ENABLE

#include <vector>
#include "./Types.h"
#include "./Command.h"
#include "./Machine.h"
#include "./Matrix.h"
#include "./Operators.h"
#include "./Sample.h"
#include "./gen/CommandConvention.h"
#include "./gen/GXRuntimeEnums.h"

//
// MatrixBlit (G40): copy from a SOURCE register into a DESTINATION register
// through a spatial transform, by INVERSE mapping (iterate dest cells, map each
// to a source coordinate, sample, combine). Faithful port of ts/ggggx/Blit.ts +
// the ts/ggggx/MatrixBlit.ts command. Sampling is delegated to Sample.h.
//
// The transform is affine, selected by `mode`, which says how the flat M
// coefficients fill the internal (rank+1)x(rank+1) homogeneous matrix. The rank
// is the destination's spatial rank ( dim.size() - dimension ). Modes (M reused
// per mode): box (default) = a source min,max rectangle in pixel coords stretched
// to fill the dest (omitted -> full source [0,dim] = identity copy); affine = the
// general matrix; map = (srcAxis,min,max) triples positional by dest axis (dest
// axis k samples source axis srcAxis over [min,max]) -- swaps axes for transpose /
// rotation, and generalizes box; offset = direct per-axis source lookup offsets
// in pixel coordinates. Box subsumes the old scale+translate; a bare box is the
// identity.
//

namespace ggg {

  // Resolve numeric enum values through the generated protocol repository. The
  // same descriptors drive D1/D5, so execution and self-description cannot drift.
  template <typename N>
  inline String blitOptionByIndex( EnumGroupIndex group, N n ) {
    const char *value = ggggxRuntimeEnumName( group, (Int) n );
    return value ? value : "";
  }

  // Row-major flat (rank+1)x(rank+1) homogeneous transform from mode + M coeffs.
  // `srcDims` (source spatial dims) is used by `box` to normalize the pixel
  // rectangle and default omitted bounds to the full source extent.
  template <typename N>
  inline std::vector<N> blitBuildTransform( const String &mode, const std::vector<N> &M, int rank,
      const std::vector<Index> &srcDims ) {
    int n = rank + 1;
    std::vector<N> H( (size_t) n * n, N( 0 ) );
    for ( int r = 0; r < n; r++ ) H[ (size_t) r * n + r ] = 1;

    if ( mode == "affine" ) {
      if ( M.empty() ) return H;
      // M = rank rows x (rank+1) cols (linear part + translation), row-major.
      for ( int r = 0; r < rank; r++ )
        for ( int c = 0; c < rank + 1; c++ ) {
          size_t idx = (size_t)( r * ( rank + 1 ) + c );
          if ( idx < M.size() ) H[ (size_t) r * n + c ] = M[idx];
        }
      return H;
    }

    if ( mode == "box" ) {
      // M = [ min_0, max_0, min_1, max_1, ... ] in source PIXEL coords. Each axis
      // maps dest-normalized c -> source-normalized ( min + c*(max-min) ) / dim.
      // Omitted min/max default to [0, dim] (full source) => identity copy.
      for ( int i = 0; i < rank; i++ ) {
        N dim = ( i < (int) srcDims.size() && srcDims[i] > 0 ) ? N( srcDims[i] ) : N( 1 );
        N lo = ( 2 * i     < (int) M.size() ) ? M[ 2 * i ]     : N( 0 );
        N hi = ( 2 * i + 1 < (int) M.size() ) ? M[ 2 * i + 1 ] : dim;
        H[ (size_t) i * n + i ]    = ( hi - lo ) / dim;
        H[ (size_t) i * n + rank ] = lo / dim;
      }
      return H;
    }

    if ( mode == "map" ) {
      // M = [ srcAxis, min, max, srcAxis, min, max, ... ], positional by DEST axis:
      // triple k says destination axis k samples SOURCE axis srcAxis over [min,max].
      // Re-pointing a dest axis at a different source axis SWAPS axes -> transpose /
      // rotation; generalizes box. Built from zero so a remapped axis drops its
      // identity diagonal; unspecified dest axes stay identity.
      std::fill( H.begin(), H.end(), N( 0 ) );
      H[ (size_t) rank * n + rank ] = 1;
      int triples = (int) M.size() / 3;
      for ( int i = 0; i < rank; i++ ) {
        int a = ( i < triples ) ? (int) NumberOps<N>::floor( M[ 3 * i ] ) : -1;
        if ( a >= 0 && a < rank ) {
          N dim = ( a < (int) srcDims.size() && srcDims[a] > 0 ) ? N( srcDims[a] ) : N( 1 );
          N lo = M[ 3 * i + 1 ];
          N hi = M[ 3 * i + 2 ];
          H[ (size_t) a * n + i ]    = ( hi - lo ) / dim;   // dest axis i drives source axis a
          H[ (size_t) a * n + rank ] = lo / dim;
        } else {
          H[ (size_t) i * n + i ] = 1;                      // unspecified / invalid -> identity
        }
      }
      return H;
    }

    // Offset bypasses the homogeneous transform in Blit().
    if ( mode == "offset" ) return H;

    // unknown / unset mode -> identity passthrough (the default box covers identity)
    return H;
  }

  // Apply the homogeneous transform to a normalized coord (perspective divide;
  // affine modes leave w == 1).
  template <typename N>
  inline std::vector<N> blitApplyHomogeneous( const std::vector<N> &H, const std::vector<N> &c, int rank ) {
    int n = rank + 1;
    N w = H[ (size_t) rank * n + rank ];
    for ( int k = 0; k < rank; k++ ) w += H[ (size_t) rank * n + k ] * c[k];
    std::vector<N> out( (size_t) rank );
    for ( int r = 0; r < rank; r++ ) {
      N v = H[ (size_t) r * n + rank ];
      for ( int k = 0; k < rank; k++ ) v += H[ (size_t) r * n + k ] * c[k];
      out[r] = v / ( w != 0 ? w : N( 1 ) );
    }
    return out;
  }

  template <class T = DefaultTraits>
  struct BlitOptionsT {
    using Number = typename T::Number;
    using Coordinate = typename T::Coordinate;
    int dimension = 0;
    String mode = "box";
    std::vector<Coordinate> matrix;
    std::vector<Index> offset;
    std::vector<Index> size;
    String op = "set";
    std::vector<String> filter;      // F: per-axis filter (continue-last)
    std::vector<String> edges;       // E: per-axis edge (continue-last)
  };
  using BlitOptions = BlitOptionsT<>;

  // Footprint (source texels, per spatial axis) covered by one dest texel, via a
  // numerical Jacobian (step one dest texel per dest axis, measure the source
  // displacement, max over directions). Mirrors ts/ggggx/Blit.ts footprintOf.
  template <typename N>
  inline std::vector<N> blitFootprint( const std::vector<N> &H, const std::vector<N> &c,
      const std::vector<Index> &destSpatial, const std::vector<Index> &srcSpatial, int rank ) {
    std::vector<N> src = blitApplyHomogeneous( H, c, rank );
    std::vector<N> fp( (size_t) rank, N( 0 ) );
    for ( int a = 0; a < rank; a++ ) {
      std::vector<N> cc = c;
      Index ds = ( a < (int) destSpatial.size() ) ? destSpatial[a] : 1;
      if ( ds < 1 ) ds = 1;
      cc[a] += N( 1 ) / N( ds );
      std::vector<N> src2 = blitApplyHomogeneous( H, cc, rank );
      for ( int b = 0; b < rank; b++ ) {
        Index ss = ( b < (int) srcSpatial.size() ) ? srcSpatial[b] : 1;
        N d = NumberOps<N>::abs( src2[b] - src[b] ) * N( ss ? ss : 1 );
        if ( d > fp[b] ) fp[b] = d;
      }
    }
    return fp;
  }

  // Inverse-mapping driver. Returns false iff an unknown combine operator was hit
  // (so the command can report OZ); the matrix is mutated in place.
  template <class T>
  inline bool Blit( MatrixBaseT<T> *dest, MatrixBaseT<T> *source, const BlitOptionsT<T> &o ) {
    using Number = typename T::Number;
    using Coordinate = typename T::Coordinate;
    int dimension = o.dimension;
    int rank = (int) dest->dim.size() - dimension;
    if ( rank < 0 ) rank = 0;

    std::vector<Index> destSpatial;
    for ( int a = 0; a < rank; a++ )
      destSpatial.push_back( dest->dim[ dimension + a ] );

    std::vector<Index> srcSpatial;
    for ( int a = 0; a < rank; a++ )
      srcSpatial.push_back( ( dimension + a < (int) source->dim.size() ) ? source->dim[ dimension + a ] : 1 );

    std::vector<Coordinate> H = blitBuildTransform( o.mode, o.matrix, rank, srcSpatial );
    const bool pixelCoordinates = o.mode == "offset";

    std::vector<Index> size = !o.size.empty() ? o.size : destSpatial;
    size.resize( rank, 0 );

    bool ok = true;
    std::vector<Index> cell( (size_t) rank, 0 );

    // Odometer over the dest region; runs once for rank 0 (a single cell).
    bool more = true;
    while ( more ) {
      std::vector<Coordinate> destCoord( (size_t) rank );
      std::vector<Coordinate> cNorm( (size_t) rank );
      for ( int a = 0; a < rank; a++ ) {
        Index oc = ( a < (int) o.offset.size() ) ? o.offset[a] : 0;
        Index dc = cell[a] + oc;
        destCoord[a] = dc;
        cNorm[a] = destSpatial[a]
          ? Coordinate( dc ) / Coordinate( destSpatial[a] ) : Coordinate( 0 );
      }

      // Offset is deliberately evaluated in pixel space. This avoids a
      // normalized divide/multiply round trip moving an exact integer below a
      // texel boundary, especially with fixed-point Coordinate types.
      std::vector<Coordinate> src( (size_t) rank );
      if ( pixelCoordinates ) {
        for ( int a = 0; a < rank; a++ ) {
          Coordinate delta = a < (int) o.matrix.size()
            ? o.matrix[a] : Coordinate( 0 );
          src[a] = destCoord[a] + delta;
        }
      } else {
        src = blitApplyHomogeneous( H, cNorm, rank );
      }

      std::vector<Coordinate> pos( (size_t) dimension, Coordinate( 0 ) );
      pos.insert( pos.end(), src.begin(), src.end() );

      // Sample per-axis: filter (I) interpolates the point; a fold (F) reduces the
      // footprint when minifying. The Jacobian footprint drives magnify vs minify.
      std::vector<Coordinate> fp = pixelCoordinates
        ? std::vector<Coordinate>( (size_t) rank, Coordinate( 1 ) )
        : blitFootprint( H, cNorm, destSpatial, srcSpatial, rank );
      std::vector<Number> sampled = Sample(
        source, pos, dimension, o.filter, o.edges, fp, pixelCoordinates
      );

      std::vector<Coordinate> destPos( (size_t) dimension, Coordinate( 0 ) );
      destPos.insert( destPos.end(), destCoord.begin(), destCoord.end() );
      for ( int ch = 0; ch < (int) sampled.size(); ch++ ) {
        if ( dimension > 0 ) destPos[0] = ch;   // single leading channel axis
        Index off = sampleOffset( dest->dim, destPos );
        if ( off < 0 ) continue;
        Number current = dest->readScalarFloat( off, 0 );
        Number result;
        if ( applyOperator( o.op, current, sampled[ch], result ) )
          dest->writeScalarFloat( result, off );
        else
          ok = false;
      }

      // advance the odometer
      more = false;
      for ( int i = 0; i < rank; i++ ) {
        if ( ++cell[i] < size[i] ) { more = true; break; }
        cell[i] = 0;
      }
    }

    return ok;
  }

  // G40 -- blit between registers. Args: R/L source, W dest, M coeffs, T mode,
  // P/S region, D channel dim, Q operator, F per-axis filter (linear/nearest point
  // or mean/min/max/add footprint fold), E per-axis edge.
  template <class T = DefaultTraits>
  class MatrixBlitT : public CommandTypeT<T> {
    using Base = CommandTypeT<T>;
    using Base::machine; using Base::code; using Base::number;
    using Base::string;  using Base::okay;  using Base::name;
    using Base::describe; using Base::addArg;

    MatrixBaseT<T> *source = nullptr;
    MatrixBaseT<T> *dest = nullptr;
    BlitOptionsT<T> opt;
  public:
    MatrixBlitT() {
      name = "G40";
      describe( "Blit (transform-copy) between registers." );
      addArg( Register, "source register index or name", "", ArgumentKind::Reference,
        (Int) EnumGroupIndex::MatrixRegister );
      addArg( Target, "destination register index or name", "", ArgumentKind::Reference,
        (Int) EnumGroupIndex::MatrixRegister );
      addArg( Transform, "transform coeffs (per mode): box = source min,max pairs; map = (srcAxis,min,max) triples per dest axis; affine = matrix; offset = source pixel offsets", "comma-list:number;one-or-more", ArgumentKind::Number );
      addArg( Storage, "transform mode: box (default) / affine / map / offset", "",
        ArgumentKind::Enum, (Int) EnumGroupIndex::Transform );
      addArg( Offset, "dest region offset", "comma-list:axes=C,X,Y,Z", ArgumentKind::Number );
      addArg( Size, "dest region size", "comma-list:axes=C,X,Y,Z", ArgumentKind::Number );
      addArg( Dimension, "channel dimension count", "", ArgumentKind::Number );
      addArg( Operator, "combine operator into dest cell", "", ArgumentKind::Enum,
        (Int) EnumGroupIndex::Operator );
      addArg( Failure, "per-axis filter (list): 0 linear / 1 nearest / 2 mean / 3 min / 4 max / 5 add", "comma-list:enum;continue-last",
        ArgumentKind::Enum, (Int) EnumGroupIndex::Filter );
      addArg( Encoding, "per-axis edge (list): 0 loop / 1 hold / 2 mirror / 3 zero", "comma-list:enum;continue-last",
        ArgumentKind::Enum, (Int) EnumGroupIndex::Edge );
    }

    void hookCommand() override {
      source = nullptr; dest = nullptr; opt = BlitOptionsT<T>(); okay = 1;
    }

    void hookNumber() override {
      switch ( code ) {
        case Register:  source = machine->getRegister( (Index) number ); break;
        case Target:    dest = machine->getRegister( (Index) number ); break;
        case Transform: opt.matrix.push_back( number ); break;
        case Storage:   opt.mode = blitOptionByIndex( EnumGroupIndex::Transform, number );
                        if ( opt.mode.empty() ) opt.mode = "box";
                        break;
        case Offset:    opt.offset.push_back( (Index) number ); break;
        case Size:      opt.size.push_back( (Index) number ); break;
        case Dimension: opt.dimension = (Index) number; break;
        case Failure:   opt.filter.push_back( blitOptionByIndex( EnumGroupIndex::Filter, number ) ); break;
        case Encoding:  opt.edges.push_back( blitOptionByIndex( EnumGroupIndex::Edge, number ) ); break;
        default: break;
      }
    }

    void hookString() override {
      switch ( code ) {
        case Register: source = machine->resolveRegisterByName( string ); break;
        case Target:    dest = machine->resolveRegisterByName( string ); break;
        case Storage:   opt.mode = string; break;
        case Operator:  opt.op = string; break;
        case Failure:   opt.filter.push_back( string ); break;
        case Encoding:  opt.edges.push_back( string ); break;
        default: break;
      }
    }

    void hookFinish() override {
      if ( !source || !dest ) { machine->outputFail( (Int) GGGFail::BufferNotFound ); return; }
      bool ok = Blit( dest, source, opt );
      if ( ok ) machine->outputOK();
      else machine->outputFail( (Int) GGGFail::BlitFailed );
    }
  };
  using MatrixBlit = MatrixBlitT<>;

}; // namespace ggg
#endif
