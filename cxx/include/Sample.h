#pragma once

#include <cmath>
#include <vector>
#include <string>
#include <algorithm>
#include "./Types.h"
#include "./Dim.h"
#include "./Matrix.h"

//
// N-D separable sampler -- faithful port of ts/ggggx/Sample.ts. At each spatial
// axis it combines the source texels the destination cell's footprint covers, per
// that axis's `combine` op: linear interpolates up (footprint <= 1) and box-means
// down (footprint > 1); nearest is a point; min/max/add fold (pool). Edge handling
// (loop/hold/mirror/zero) is per axis; coordinates are always normalized. The
// leading `dimension` axes are channels, read as one contiguous block. This is the
// sampling primitive under MatrixBlit (G40).
//

namespace ggg {

  namespace SampleOpt {
    constexpr const char *Linear  = "linear";
    constexpr const char *Nearest = "nearest";
    constexpr const char *Hold    = "hold";
    constexpr const char *Repeat  = "repeat";   // = "loop" (the E arg index-0 name)
    constexpr const char *Mirror  = "mirror";
    constexpr const char *Zero    = "zero";
    constexpr const char *None    = "none";
    constexpr const char *Mean    = "mean";
    constexpr const char *Min     = "min";
    constexpr const char *Max     = "max";
    constexpr const char *Add     = "add";
  }

  struct ResolvedAxis {
    Index index0;
    Index index1;
    double fraction;
  };

  // Non-negative modulo, matching the TS common/math `mod` (a%n+n)%n.
  inline Index sampleMod( Index a, Index n ) {
    if ( n == 0 ) return 0;
    return ( ( a % n ) + n ) % n;
  }

  // Flat offset from an integer-valued coordinate, mirroring ts/ggg/Dim DimOffset:
  // axes past the first are range-checked (out of range => -1), axis 0 is not.
  inline Index sampleOffset( const DimType &dim, const std::vector<double> &coord ) {
    Index dimIndex = 0;
    Index mult = 1;
    long offset = 0;
    for ( size_t a = 0; a < coord.size(); a++ ) {
      long arg = (long) std::floor( coord[a] );
      Index adim = ( dimIndex < (Index) dim.size() && dim[dimIndex] > 0 ) ? dim[dimIndex] : 1;
      if ( dimIndex > 0 && ( arg >= adim || arg < 0 ) ) {
        return -1;
      }
      offset += arg * mult;
      mult *= adim;
      dimIndex++;
    }
    return offset < 0 ? -1 : (Index) offset;
  }

  // Resolve a normalized axis position to texel index(es). `filter` only chooses 1
  // vs 2 taps (nearest vs linear) + the fraction; `edge` clamps/wraps. Coordinate
  // modes (pixel/fence) were dropped -- always normalized (norm = size).
  inline ResolvedAxis resolveAxis( double val, Index size, const String &filter, const String &edge ) {
    ResolvedAxis axis { 0, 0, 0. };

    if ( size < 1 ) size = 1;
    val *= size;
    axis.index0 = (Index) std::floor( val );

    if ( edge == SampleOpt::Zero ) {
      if ( axis.index0 < 0 || axis.index0 >= size ) axis.index0 = -1;
    } else if ( edge == SampleOpt::Hold ) {
      axis.index0 = std::max( 0, std::min( size - 1, axis.index0 ) );
    } else if ( edge == SampleOpt::Mirror ) {
      bool mirrored = ( (long) std::floor( val / size ) ) % 2 == 0;
      axis.index0 = mirrored ? sampleMod( axis.index0, size ) : size - 1 - sampleMod( axis.index0, size );
    } else { // Repeat (loop)
      axis.index0 = sampleMod( axis.index0, size );
    }

    if ( filter == SampleOpt::Nearest ) {
      axis.index1 = axis.index0;
      axis.fraction = 0.;
    } else {
      axis.fraction = val - std::floor( val );
      axis.index1 = (Index) std::floor( val + 1 );
      if ( edge == SampleOpt::Zero ) {
        if ( axis.index1 < 0 || axis.index1 >= size ) axis.index1 = -1;
      } else if ( edge == SampleOpt::Hold ) {
        axis.index1 = std::max( 0, std::min( size - 1, axis.index1 ) );
      } else if ( edge == SampleOpt::Mirror ) {
        bool mirrored = ( (long) std::floor( ( val + 1 ) / size ) ) % 2 == 0;
        axis.index1 = mirrored ? sampleMod( axis.index1, size ) : size - 1 - sampleMod( axis.index1, size );
      } else { // Repeat (loop)
        axis.index1 = sampleMod( axis.index1, size );
        if ( axis.index1 < 0 ) axis.index1 += size;
      }
    }

    return axis;
  }

  // Read `length` contiguous channel scalars from the flat offset of `pos`
  // (out-of-range => 0).
  // T is deduced from the buffer, so call sites are unchanged. The sampler works
  // in double internally; Number appears only where values enter and leave.
  template <class T>
  inline void sampleReadChannels( MatrixBaseT<T> *buffer, const std::vector<double> &pos,
      Index length, std::vector<typename T::Number> &out ) {
    Index offset = sampleOffset( buffer->dim, pos );
    for ( Index k = 0; k < length; k++ )
      out[k] = ( offset >= 0 ) ? buffer->readScalarFloat( offset + k, 0. ) : 0.;
  }

  // Continue-last pick from a per-axis option list (one value broadcasts to all).
  inline const String & samplePick( const std::vector<String> &list, int a, const String &dflt ) {
    if ( list.empty() ) return dflt;
    if ( a < 0 ) a = 0;
    if ( a >= (int) list.size() ) a = (int) list.size() - 1;
    return list[a];
  }

  // Is this filter op a footprint fold (vs a point filter linear/nearest)?
  inline bool sampleIsFold( const String &op ) {
    return op == SampleOpt::Mean || op == SampleOpt::Min || op == SampleOpt::Max || op == SampleOpt::Add;
  }

  template <class T>
  inline std::vector<typename T::Number> sampleCombineAxis( MatrixBaseT<T> *buffer, std::vector<double> &pos,
      Index dimIndex, Index dimension, Index length,
      const std::vector<String> &filter, const std::vector<String> &edges, const std::vector<double> &footprint ) {
    using Number = typename T::Number;
    static const String dfltFilter = SampleOpt::Linear;
    static const String dfltEdge = SampleOpt::Repeat;
    const int MAX_TAPS = 8;
    const double EPS = 1e-6;

    int a = (int) dimIndex - (int) dimension;
    const String &op = samplePick( filter, a, dfltFilter );
    const String &edge = samplePick( edges, a, dfltEdge );
    double fp = ( a >= 0 && a < (int) footprint.size() ) ? footprint[a] : 0.;
    Index size = ( dimIndex >= 0 && dimIndex < (Index) buffer->dim.size() ) ? buffer->dim[dimIndex] : 1;
    if ( size < 1 ) size = 1;
    double center = ( dimIndex >= 0 && dimIndex < (Index) pos.size() ) ? pos[dimIndex] : 0.;

    auto inner = [&]() -> std::vector<Number> {
      if ( dimIndex > dimension )
        return sampleCombineAxis( buffer, pos, dimIndex - 1, dimension, length, filter, edges, footprint );
      std::vector<Number> out( length, 0. );
      sampleReadChannels( buffer, pos, length, out );
      return out;
    };

    // MINIFY fold (mean/min/max/add): point-sample the footprint's taps and reduce.
    if ( sampleIsFold( op ) && fp > 1.0 + EPS ) {
      int taps = (int) std::ceil( fp - EPS );
      if ( taps < 1 ) taps = 1;
      if ( taps > MAX_TAPS ) taps = MAX_TAPS;
      double fpNorm = fp / size;
      bool isMin = ( op == SampleOpt::Min ), isMax = ( op == SampleOpt::Max );
      double init = isMin ? INFINITY : isMax ? -INFINITY : 0.;
      std::vector<double> acc( (size_t) length, init );
      for ( int t = 0; t < taps; t++ ) {
        double offset = taps > 1 ? ( ( t + 0.5 ) / taps - 0.5 ) : 0.;
        if ( dimIndex >= 0 ) pos[dimIndex] = resolveAxis( center + fpNorm * offset, size, SampleOpt::Nearest, edge ).index0;
        std::vector<Number> s = inner();
        for ( Index i = 0; i < length; i++ ) {
          if ( isMin ) acc[i] = std::min( acc[i], (double) s[i] );
          else if ( isMax ) acc[i] = std::max( acc[i], (double) s[i] );
          else acc[i] += s[i];
        }
      }
      std::vector<Number> out( (size_t) length );
      if ( op == SampleOpt::Mean )
        for ( Index i = 0; i < length; i++ ) out[i] = (Number)( acc[i] / taps );
      else
        for ( Index i = 0; i < length; i++ ) out[i] = (Number) acc[i];
      return out;
    }

    // linear lerps; nearest (and a fold op when magnifying) point-samples the centre.
    if ( op != SampleOpt::Linear ) {
      if ( dimIndex >= 0 ) pos[dimIndex] = resolveAxis( center, size, SampleOpt::Nearest, edge ).index0;
      return inner();
    }
    ResolvedAxis r = resolveAxis( center, size, SampleOpt::Linear, edge );
    if ( dimIndex >= 0 ) pos[dimIndex] = r.index0;
    std::vector<Number> sampA = inner();
    if ( r.fraction == 0. || r.index0 == r.index1 ) return sampA;
    if ( dimIndex >= 0 ) pos[dimIndex] = r.index1;
    std::vector<Number> sampB = inner();
    for ( Index i = 0; i < length; i++ )
      sampA[i] = sampA[i] * ( 1. - r.fraction ) + sampB[i] * r.fraction;
    return sampA;
  }

  // Sample `buffer` at `position` with the per-axis `filter` op (linear/nearest
  // point, or mean/min/max/add footprint fold) + `edges` + per-axis `footprint`.
  // Returns one value per channel.
  template <class T>
  inline std::vector<typename T::Number> Sample( MatrixBaseT<T> *buffer, std::vector<double> position,
      Index dimension = 0, const std::vector<String> &filter = {},
      const std::vector<String> &edges = {}, const std::vector<double> &footprint = {} ) {
    using Number = typename T::Number;
    Index channels = 1;
    for ( Index d = 0; d < dimension && d < (Index) buffer->dim.size(); d++ )
      channels *= buffer->dim[d];
    if ( channels < 1 ) channels = 1;

    if ( position.empty() ) {
      std::vector<Number> out( channels, 0. );
      sampleReadChannels( buffer, position, channels, out );
      return out;
    }

    return sampleCombineAxis( buffer, position, (Index) position.size() - 1,
        dimension, channels, filter, edges, footprint );
  }

}; // namespace ggg
