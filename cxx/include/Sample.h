#pragma once

#include <cmath>
#include <vector>
#include <algorithm>
#include "./Types.h"
#include "./Dim.h"
#include "./Matrix.h"

//
// N-D separable interpolating sampler -- faithful port of ts/ggggx/Sample.ts.
// Reads a (possibly multi-channel) sample from a matrix at a fractional
// position, with selectable Filter (linear/nearest), Edge (hold/repeat/mirror/
// zero) and Coord (normalized/pixel/fence) behaviour. The leading `dimension`
// axes are channel axes (read as one contiguous block); the rest are spatial
// and interpolated. This is the sampling primitive under MatrixBlit (G40).
//
// Option names mirror the TS Filter/Edge/Coord enums (ts/ggggx/GXLanguage.ts).
// Empty string => the TS default (linear / repeat / normalized).
//

namespace ggg {

  namespace SampleOpt {
    constexpr const char *Linear     = "linear";
    constexpr const char *Nearest    = "nearest";
    constexpr const char *Hold       = "hold";
    constexpr const char *Repeat     = "repeat";
    constexpr const char *Mirror     = "mirror";
    constexpr const char *Zero       = "zero";
    constexpr const char *Normalized = "normalized";
    constexpr const char *Pixel      = "pixel";
    constexpr const char *Fence      = "fence";
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

  inline ResolvedAxis resolveAxis( double val, Index size,
      const String &filter, const String &edge, const String &coord ) {
    ResolvedAxis axis { 0, 0, 0. };

    if ( size < 1 ) size = 1;

    double norm = size;
    if ( coord == SampleOpt::Fence )
      norm = ( filter == SampleOpt::Linear ) ? (double)( size - 1 ) : (double) size;
    else if ( coord == SampleOpt::Pixel )
      norm = 1.;

    val *= norm;
    axis.index0 = (Index) std::floor( val );

    if ( edge == SampleOpt::Zero ) {
      if ( axis.index0 < 0 || axis.index0 >= size ) axis.index0 = -1;
    } else if ( edge == SampleOpt::Hold ) {
      axis.index0 = std::max( 0, std::min( size - 1, axis.index0 ) );
    } else if ( edge == SampleOpt::Mirror ) {
      bool mirrored = ( (long) std::floor( val / size ) ) % 2 == 0;
      axis.index0 = mirrored ? sampleMod( axis.index0, size ) : size - 1 - sampleMod( axis.index0, size );
    } else { // Repeat (default)
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
      } else { // Repeat (default)
        axis.index1 = sampleMod( axis.index1, size );
      }
    }

    return axis;
  }

  // Read `length` contiguous channel scalars from the flat offset of `pos`.
  // (Out-of-range => 0; the TS Matrix.read leaves the slot at its default, which
  // for the realistic non-zero-edge paths never happens.)
  inline void sampleReadChannels( MatrixBase *buffer, const std::vector<double> &pos,
      Index length, std::vector<NumberType> &out ) {
    Index offset = sampleOffset( buffer->dim, pos );
    for ( Index k = 0; k < length; k++ )
      out[k] = ( offset >= 0 ) ? buffer->readScalarFloat( offset + k, 0. ) : 0.;
  }

  inline std::vector<NumberType> sampleComputeAxis( MatrixBase *buffer, std::vector<double> &pos,
      Index dimIndex, Index dimension, Index length,
      const String &filter, const String &edge, const String &coord ) {
    double position = ( dimIndex >= 0 && dimIndex < (Index) pos.size() ) ? pos[dimIndex] : 0.;
    Index axisSize = ( dimIndex >= 0 && dimIndex < (Index) buffer->dim.size() ) ? buffer->dim[dimIndex] : 1;
    ResolvedAxis r = resolveAxis( position, axisSize, filter, edge, coord );

    if ( dimIndex >= 0 ) pos[dimIndex] = r.index0;
    std::vector<NumberType> sampA( length, 0. );
    if ( dimIndex > dimension )
      sampA = sampleComputeAxis( buffer, pos, dimIndex - 1, dimension, length, filter, edge, coord );
    else
      sampleReadChannels( buffer, pos, length, sampA );

    if ( r.fraction == 0. || r.index0 == r.index1 )
      return sampA;

    if ( dimIndex >= 0 ) pos[dimIndex] = r.index1;
    std::vector<NumberType> sampB( length, 0. );
    if ( dimIndex > dimension )
      sampB = sampleComputeAxis( buffer, pos, dimIndex - 1, dimension, length, filter, edge, coord );
    else
      sampleReadChannels( buffer, pos, length, sampB );

    for ( Index i = 0; i < length; i++ )
      sampA[i] = sampA[i] * ( 1. - r.fraction ) + sampB[i] * r.fraction;
    return sampA;
  }

  // Sample `buffer` at fractional `position`. Returns one value per channel
  // (channels = product of the leading `dimension` axis sizes; >=1).
  inline std::vector<NumberType> Sample( MatrixBase *buffer, std::vector<double> position,
      Index dimension = 1, String filter = "", String edge = "", String coord = "" ) {
    if ( filter.empty() ) filter = SampleOpt::Linear;
    if ( edge.empty() ) edge = SampleOpt::Repeat;
    if ( coord.empty() ) coord = SampleOpt::Normalized;

    Index channels = 1;
    for ( Index d = 0; d < dimension && d < (Index) buffer->dim.size(); d++ )
      channels *= buffer->dim[d];
    if ( channels < 1 ) channels = 1;

    if ( position.empty() ) {
      std::vector<NumberType> out( channels, 0. );
      sampleReadChannels( buffer, position, channels, out );
      return out;
    }

    return sampleComputeAxis( buffer, position, (Index) position.size() - 1,
        dimension, channels, filter, edge, coord );
  }

  // Reduce (minification) operators for SampleReduce's footprint fold. Index
  // order is the contract for the E sampler-options slot 3 (mirrors ts ReduceList).
  inline const std::vector<String> & sampleReduceList() {
    static const std::vector<String> v = { "mid", "min", "max", "add" };
    return v;
  }

  // Minification: integrate the source over a footprint box around `position`
  // (extent in source texels, per spatial axis) and fold the covered samples with
  // a reduce op -- mid (mean) / min / max / add (sum). Walks a taps-per-axis grid
  // (taps = clamp(ceil(footprint),1,MAX_TAPS)); footprint <= 1 => a single point
  // sample. Faithful port of ts/ggggx/Sample.ts SampleReduce.
  inline std::vector<NumberType> SampleReduce( MatrixBase *buffer, std::vector<double> position,
      const std::vector<double> &footprint, const String &reduce, Index dimension = 0,
      String filter = "", String edge = "", String coord = "" ) {
    const int MAX_TAPS = 8;

    Index channels = 1;
    for ( Index d = 0; d < dimension && d < (Index) buffer->dim.size(); d++ )
      channels *= buffer->dim[d];
    if ( channels < 1 ) channels = 1;

    int rank = (int) position.size() - dimension;
    if ( rank < 0 ) rank = 0;

    std::vector<int> taps( (size_t) rank, 1 );
    for ( int a = 0; a < rank; a++ ) {
      double f = ( a < (int) footprint.size() ) ? footprint[a] : 1.;
      int t = (int) std::ceil( f );
      if ( t < 1 ) t = 1;
      if ( t > MAX_TAPS ) t = MAX_TAPS;
      taps[a] = t;
    }

    double init = ( reduce == "min" ) ? INFINITY : ( reduce == "max" ) ? -INFINITY : 0.;
    std::vector<double> acc( (size_t) channels, init );
    long count = 0;

    std::vector<int> combo( (size_t) rank, 0 );
    bool more = true;
    while ( more ) {
      std::vector<double> pos = position;
      for ( int a = 0; a < rank; a++ ) {
        Index srcSize = ( dimension + a < (Index) buffer->dim.size() ) ? buffer->dim[ dimension + a ] : 1;
        if ( srcSize < 1 ) srcSize = 1;
        double fpNorm = ( ( a < (int) footprint.size() ) ? footprint[a] : 0. ) / srcSize;
        double t = taps[a] > 1 ? ( ( combo[a] + 0.5 ) / taps[a] - 0.5 ) : 0.;
        pos[ dimension + a ] += fpNorm * t;
      }
      std::vector<NumberType> s = Sample( buffer, pos, dimension, filter, edge, coord );
      for ( Index ch = 0; ch < channels; ch++ ) {
        double v = s[ch];
        if ( reduce == "min" ) acc[ch] = std::min( acc[ch], v );
        else if ( reduce == "max" ) acc[ch] = std::max( acc[ch], v );
        else acc[ch] += v;                                  // add + mid both sum
      }
      count++;

      more = false;
      for ( int i = 0; i < rank; i++ ) {
        if ( ++combo[i] < taps[i] ) { more = true; break; }
        combo[i] = 0;
      }
    }

    if ( reduce == "mid" && count > 0 )
      for ( Index ch = 0; ch < channels; ch++ ) acc[ch] /= count;

    std::vector<NumberType> out( (size_t) channels );
    for ( Index ch = 0; ch < channels; ch++ ) out[ch] = (NumberType) acc[ch];
    return out;
  }

}; // namespace ggg
