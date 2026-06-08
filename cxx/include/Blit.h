#pragma once

#include <vector>
#include "./Types.h"
#include "./Command.h"
#include "./Machine.h"
#include "./Matrix.h"
#include "./Operators.h"
#include "./Sample.h"
#include "./gen/CommandConvention.h"

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
// general matrix; map = box with (axis,min,max) triples (remap one axis, leave the
// rest identity). Box subsumes the old scale+translate; a bare box is the identity.
//

namespace ggg {

  // Option vocabularies (index order), mirroring ts/ggggx/Blit.ts + GXLanguage.
  inline String blitOptionByIndex( const std::vector<String> &list, double n ) {
    int i = (int) n;
    if ( i >= 0 && i < (int) list.size() ) return list[i];
    return "";
  }
  inline const std::vector<String> & blitModes() {
    static const std::vector<String> v = { "box", "affine", "map" };
    return v;
  }
  inline const std::vector<String> & blitFilters() {
    static const std::vector<String> v = { SampleOpt::Linear, SampleOpt::Nearest };
    return v;
  }
  inline const std::vector<String> & blitEdges() {
    static const std::vector<String> v = { SampleOpt::Hold, SampleOpt::Repeat, SampleOpt::Mirror, SampleOpt::Zero };
    return v;
  }
  inline const std::vector<String> & blitCoords() {
    static const std::vector<String> v = { SampleOpt::Normalized, SampleOpt::Pixel, SampleOpt::Fence };
    return v;
  }

  // Row-major flat (rank+1)x(rank+1) homogeneous transform from mode + M coeffs.
  // `srcDims` (source spatial dims) is used by `box` to normalize the pixel
  // rectangle and default omitted bounds to the full source extent.
  inline std::vector<double> blitBuildTransform( const String &mode, const std::vector<double> &M, int rank,
      const std::vector<Index> &srcDims ) {
    int n = rank + 1;
    std::vector<double> H( (size_t) n * n, 0. );
    for ( int r = 0; r < n; r++ ) H[ (size_t) r * n + r ] = 1.;

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
        double dim = ( i < (int) srcDims.size() && srcDims[i] > 0 ) ? (double) srcDims[i] : 1.;
        double lo = ( 2 * i     < (int) M.size() ) ? M[ 2 * i ]     : 0.;
        double hi = ( 2 * i + 1 < (int) M.size() ) ? M[ 2 * i + 1 ] : dim;
        H[ (size_t) i * n + i ]    = ( hi - lo ) / dim;
        H[ (size_t) i * n + rank ] = lo / dim;
      }
      return H;
    }

    if ( mode == "map" ) {
      // M = [ axis, min, max, axis, min, max, ... ] -- each triple sets one named
      // axis's source rect (pixel coords), like box but axis-addressed. Axes not
      // named stay identity; incomplete trailing triples are ignored.
      for ( int i = 0; i + 3 <= (int) M.size(); i += 3 ) {
        int axis = (int) std::floor( M[i] );
        if ( axis < 0 || axis >= rank ) continue;
        double dim = ( axis < (int) srcDims.size() && srcDims[axis] > 0 ) ? (double) srcDims[axis] : 1.;
        double lo = M[ i + 1 ];
        double hi = M[ i + 2 ];
        H[ (size_t) axis * n + axis ] = ( hi - lo ) / dim;
        H[ (size_t) axis * n + rank ] = lo / dim;
      }
      return H;
    }

    // unknown / unset mode -> identity passthrough (the default box covers identity)
    return H;
  }

  // Apply the homogeneous transform to a normalized coord (perspective divide;
  // affine modes leave w == 1).
  inline std::vector<double> blitApplyHomogeneous( const std::vector<double> &H, const std::vector<double> &c, int rank ) {
    int n = rank + 1;
    double w = H[ (size_t) rank * n + rank ];
    for ( int k = 0; k < rank; k++ ) w += H[ (size_t) rank * n + k ] * c[k];
    std::vector<double> out( (size_t) rank );
    for ( int r = 0; r < rank; r++ ) {
      double v = H[ (size_t) r * n + rank ];
      for ( int k = 0; k < rank; k++ ) v += H[ (size_t) r * n + k ] * c[k];
      out[r] = v / ( w != 0. ? w : 1. );
    }
    return out;
  }

  struct BlitOptions {
    int dimension = 0;
    String mode = "box";
    std::vector<double> matrix;
    std::vector<Index> offset;
    std::vector<Index> size;
    String op = "set";
    String filter, edge, coord;
    String reduce;                   // minification fold; empty => point sample
  };

  // Footprint (source texels, per spatial axis) covered by one dest texel, via a
  // numerical Jacobian (step one dest texel per dest axis, measure the source
  // displacement, max over directions). Mirrors ts/ggggx/Blit.ts footprintOf.
  inline std::vector<double> blitFootprint( const std::vector<double> &H, const std::vector<double> &c,
      const std::vector<Index> &destSpatial, const std::vector<Index> &srcSpatial, int rank ) {
    std::vector<double> src = blitApplyHomogeneous( H, c, rank );
    std::vector<double> fp( (size_t) rank, 0. );
    for ( int a = 0; a < rank; a++ ) {
      std::vector<double> cc = c;
      Index ds = ( a < (int) destSpatial.size() ) ? destSpatial[a] : 1;
      if ( ds < 1 ) ds = 1;
      cc[a] += 1.0 / ds;
      std::vector<double> src2 = blitApplyHomogeneous( H, cc, rank );
      for ( int b = 0; b < rank; b++ ) {
        Index ss = ( b < (int) srcSpatial.size() ) ? srcSpatial[b] : 1;
        double d = std::fabs( src2[b] - src[b] ) * ( ss ? ss : 1 );
        if ( d > fp[b] ) fp[b] = d;
      }
    }
    return fp;
  }

  // Inverse-mapping driver. Returns false iff an unknown combine operator was hit
  // (so the command can report OZ); the matrix is mutated in place.
  inline bool Blit( MatrixBase *dest, MatrixBase *source, const BlitOptions &o ) {
    int dimension = o.dimension;
    int rank = (int) dest->dim.size() - dimension;
    if ( rank < 0 ) rank = 0;

    std::vector<Index> destSpatial;
    for ( int a = 0; a < rank; a++ )
      destSpatial.push_back( dest->dim[ dimension + a ] );

    std::vector<Index> srcSpatial;
    for ( int a = 0; a < rank; a++ )
      srcSpatial.push_back( ( dimension + a < (int) source->dim.size() ) ? source->dim[ dimension + a ] : 1 );

    std::vector<double> H = blitBuildTransform( o.mode, o.matrix, rank, srcSpatial );

    std::vector<Index> size = !o.size.empty() ? o.size : destSpatial;
    size.resize( rank, 0 );

    bool ok = true;
    std::vector<Index> cell( (size_t) rank, 0 );

    // Odometer over the dest region; runs once for rank 0 (a single cell).
    bool more = true;
    while ( more ) {
      std::vector<double> destCoord( (size_t) rank );
      std::vector<double> cNorm( (size_t) rank );
      for ( int a = 0; a < rank; a++ ) {
        Index oc = ( a < (int) o.offset.size() ) ? o.offset[a] : 0;
        Index dc = cell[a] + oc;
        destCoord[a] = dc;
        cNorm[a] = destSpatial[a] ? (double) dc / destSpatial[a] : 0.;
      }

      std::vector<double> src = blitApplyHomogeneous( H, cNorm, rank );

      std::vector<double> pos( (size_t) dimension, 0. );
      pos.insert( pos.end(), src.begin(), src.end() );

      // With a reduce op, integrate the transform-derived footprint (minification);
      // SampleReduce degrades to a point sample when the footprint is <= 1 texel.
      std::vector<NumberType> sampled;
      if ( !o.reduce.empty() ) {
        std::vector<double> fp = blitFootprint( H, cNorm, destSpatial, srcSpatial, rank );
        sampled = SampleReduce( source, pos, fp, o.reduce, dimension, o.filter, o.edge, o.coord );
      } else {
        sampled = Sample( source, pos, dimension, o.filter, o.edge, o.coord );
      }

      std::vector<double> destPos( (size_t) dimension, 0. );
      destPos.insert( destPos.end(), destCoord.begin(), destCoord.end() );
      for ( int ch = 0; ch < (int) sampled.size(); ch++ ) {
        if ( dimension > 0 ) destPos[0] = ch;   // single leading channel axis
        Index off = sampleOffset( dest->dim, destPos );
        if ( off < 0 ) continue;
        NumberType current = dest->readScalarFloat( off, 0. );
        NumberType result;
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
  // P/S region, D channel dim, Q operator, E sampler options [filter,edge,coord].
  class MatrixBlit : public CommandType {
    MatrixBase *source = nullptr;
    MatrixBase *dest = nullptr;
    BlitOptions opt;
    int eIndex = 0;
  public:
    MatrixBlit() {
      name = "G40";
      description = "Blit (transform-copy) between registers.";
      addArg( Register, "source register index or name", "(n|s)" );
      addArg( Alias, "source register name", "(s)" );
      addArg( Target, "destination register index or name", "(n|s)" );
      addArg( Transform, "transform coeffs (per mode): box = source min,max pairs; map = (axis,min,max) triples; affine = matrix", "(n+)" );
      addArg( Storage, "transform mode: box (default) / affine / map", "(n|s)" );
      addArg( Offset, "dest region offset", "(n+)" );
      addArg( Size, "dest region size", "(n+)" );
      addArg( Dimension, "channel dimension count", "(n)" );
      addArg( Operator, "combine operator into dest cell", "(s)" );
      addArg( Encoding, "sampler options: filter, edge, coord, reduce", "(*)" );
    }

    void hookCommand() override {
      source = nullptr; dest = nullptr; opt = BlitOptions(); eIndex = 0; okay = 1;
    }

    // E is positional: 0 = filter, 1 = edge, 2 = coord, 3 = reduce (index or name).
    void applyEOption( bool isNum, double num, const String &str ) {
      switch ( eIndex ) {
        case 0: opt.filter = isNum ? blitOptionByIndex( blitFilters(), num )      : str; break;
        case 1: opt.edge   = isNum ? blitOptionByIndex( blitEdges(), num )        : str; break;
        case 2: opt.coord  = isNum ? blitOptionByIndex( blitCoords(), num )       : str; break;
        case 3: opt.reduce = isNum ? blitOptionByIndex( sampleReduceList(), num ) : str; break;
        default: break;
      }
      eIndex++;
    }

    void hookNumber() override {
      switch ( code ) {
        case Register:  source = machine->getRegister( (Index) number ); break;
        case Target:    dest = machine->getRegister( (Index) number ); break;
        case Transform: opt.matrix.push_back( number ); break;
        case Storage:   opt.mode = blitOptionByIndex( blitModes(), number );
                        if ( opt.mode.empty() ) opt.mode = "box";
                        break;
        case Offset:    opt.offset.push_back( (Index) number ); break;
        case Size:      opt.size.push_back( (Index) number ); break;
        case Dimension: opt.dimension = (Index) number; break;
        case Encoding:  applyEOption( true, number, "" ); break;
        default: break;
      }
    }

    void hookString() override {
      switch ( code ) {
        case Register: case Alias: source = machine->resolveRegisterByName( string ); break;
        case Target:    dest = machine->resolveRegisterByName( string ); break;
        case Storage:   opt.mode = string; break;
        case Operator:  opt.op = string; break;
        case Encoding:  applyEOption( false, 0, string ); break;
        default: break;
      }
    }

    void hookFinish() override {
      if ( !source || !dest ) { machine->outputOK( 0 ); return; }
      bool ok = Blit( dest, source, opt );
      machine->outputOK( ok ? okay : 0 );
    }
  };

}; // namespace ggg
