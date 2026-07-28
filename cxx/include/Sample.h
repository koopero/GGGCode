#pragma once
#include "./Config.h"
#if GGGGX_ENABLE

#include <cmath>
#include <vector>
#include <string>
#include <algorithm>
#include "./Types.h"
#include "./Dim.h"
#include "./Matrix.h"
#include "./ggg/NumberOps.h"

//
// N-D separable sampler -- faithful port of ts/ggggx/Sample.ts. At each spatial
// axis it combines the source texels the destination cell's footprint covers, per
// that axis's `combine` op: linear interpolates up (footprint <= 1) and box-means
// down (footprint > 1); nearest is a point; min/max/add fold (pool). Edge handling
// (loop/hold/mirror/zero) is per axis. Coordinates are normalized by default;
// the blit's offset mode uses the internal pixel-coordinate path so integer
// stencil offsets remain exact. The leading `dimension` axes are channels, read
// as one contiguous block. This is the sampling primitive under MatrixBlit (G40).
//

namespace ggg {

  template <typename N, typename C>
  inline N sampleWeighted( N value, C weight ) {
    return static_cast<N>( value * weight );
  }

  template <typename NRep, std::int64_t NScale, typename NWide, bool NF,
            typename CRep, std::int64_t CScale, typename CWide, bool CF>
  inline ScaledNumber<NRep, NScale, NWide, NF> sampleWeighted(
    ScaledNumber<NRep, NScale, NWide, NF> value,
    ScaledNumber<CRep, CScale, CWide, CF> weight
  ) {
    using N = ScaledNumber<NRep, NScale, NWide, NF>;
    using Common = typename std::common_type<NWide, CWide, std::int64_t>::type;
    const Common numerator =
      static_cast<Common>( value.raw() ) * static_cast<Common>( weight.raw() );
    const Common denominator = static_cast<Common>( CScale );
    const Common raw = numerator < 0
      ? ( numerator - denominator / 2 ) / denominator
      : ( numerator + denominator / 2 ) / denominator;
    return N::fromRaw( static_cast<NWide>( raw ) );
  }

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

  template <typename N>
  struct ResolvedAxisT {
    Index index0;
    Index index1;
    N fraction;
  };

  // Non-negative modulo, matching the TS common/math `mod` (a%n+n)%n.
  inline Index sampleMod( Index a, Index n ) {
    if ( n == 0 ) return 0;
    return ( ( a % n ) + n ) % n;
  }

  // Flat offset from an integer-valued coordinate, mirroring ts/ggg/Dim DimOffset:
  // axes past the first are range-checked (out of range => -1), axis 0 is not.
  template <typename N>
  inline Index sampleOffset( const DimType &dim, const std::vector<N> &coord ) {
    Index dimIndex = 0;
    Index mult = 1;
    long offset = 0;
    for ( size_t a = 0; a < coord.size(); a++ ) {
      long arg = (long) NumberOps<N>::floor( coord[a] );
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

  // Resolve a normalized (default) or pixel-space axis position to texel
  // index(es). `filter` only chooses 1 vs 2 taps; `edge` clamps/wraps.
  template <typename N>
  inline ResolvedAxisT<N> resolveAxis( N val, Index size, const String &filter,
      const String &edge, bool pixelCoordinates = false ) {
    ResolvedAxisT<N> axis { 0, 0, 0 };

    if ( size < 1 ) size = 1;
    if ( !pixelCoordinates ) val *= N( size );
    axis.index0 = (Index) NumberOps<N>::floorCoordinate( val );

    if ( edge == SampleOpt::Zero ) {
      if ( axis.index0 < 0 || axis.index0 >= size ) axis.index0 = -1;
    } else if ( edge == SampleOpt::Hold ) {
      axis.index0 = std::max( 0, std::min( size - 1, axis.index0 ) );
    } else if ( edge == SampleOpt::Mirror ) {
      bool mirrored = ( (long) NumberOps<N>::floorCoordinate( val / N( size ) ) ) % 2 == 0;
      axis.index0 = mirrored ? sampleMod( axis.index0, size ) : size - 1 - sampleMod( axis.index0, size );
    } else { // Repeat (loop)
      axis.index0 = sampleMod( axis.index0, size );
    }

    if ( filter == SampleOpt::Nearest ) {
      axis.index1 = axis.index0;
      axis.fraction = 0;
    } else {
      axis.fraction = val - NumberOps<N>::floorCoordinate( val );
      if ( axis.fraction < 0 ) axis.fraction = 0;
      if ( NumberOps<N>::abs( axis.fraction ) <= NumberOps<N>::coordinateEpsilon() )
        axis.fraction = 0;
      axis.index1 = (Index) NumberOps<N>::floorCoordinate( val + 1 );
      if ( edge == SampleOpt::Zero ) {
        if ( axis.index1 < 0 || axis.index1 >= size ) axis.index1 = -1;
      } else if ( edge == SampleOpt::Hold ) {
        axis.index1 = std::max( 0, std::min( size - 1, axis.index1 ) );
      } else if ( edge == SampleOpt::Mirror ) {
        bool mirrored = ( (long) NumberOps<N>::floorCoordinate( ( val + 1 ) / N( size ) ) ) % 2 == 0;
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
  // T is deduced from the buffer; coordinates and accumulation use T::Number so
  // a fixed machine never detours through a floating-point working type.
  template <class T>
  inline void sampleReadChannels( MatrixBaseT<T> *buffer, const std::vector<typename T::Coordinate> &pos,
      Index length, std::vector<typename T::Number> &out ) {
    // Edge.Zero resolves an out-of-range spatial axis to -1. sampleOffset
    // permits axis-0 offsets for contiguous channel access, so consume the
    // sentinel before it can alias the preceding row.
    for ( size_t a = 0; a < pos.size(); a++ ) {
      if ( pos[a] < typename T::Coordinate( 0 ) ) {
        std::fill( out.begin(), out.end(), typename T::Number( 0 ) );
        return;
      }
    }
    Index offset = sampleOffset( buffer->dim, pos );
    for ( Index k = 0; k < length; k++ )
      out[k] = ( offset >= 0 ) ? buffer->readScalarFloat( offset + k, 0 ) : typename T::Number( 0 );
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
  inline std::vector<typename T::Number> sampleCombineAxis(
      MatrixBaseT<T> *buffer, std::vector<typename T::Coordinate> &pos,
      Index dimIndex, Index dimension, Index length,
      const std::vector<String> &filter, const std::vector<String> &edges,
      const std::vector<typename T::Coordinate> &footprint,
      bool pixelCoordinates ) {
    using Number = typename T::Number;
    using Coordinate = typename T::Coordinate;
    static const String dfltFilter = SampleOpt::Linear;
    static const String dfltEdge = SampleOpt::Repeat;
    const int MAX_TAPS = 8;
    const Coordinate coordEpsilon = NumberOps<Coordinate>::epsilon();

    int a = (int) dimIndex - (int) dimension;
    const String &op = samplePick( filter, a, dfltFilter );
    const String &edge = samplePick( edges, a, dfltEdge );
    Coordinate fp = ( a >= 0 && a < (int) footprint.size() )
      ? footprint[a] : Coordinate( 0 );
    Index size = ( dimIndex >= 0 && dimIndex < (Index) buffer->dim.size() ) ? buffer->dim[dimIndex] : 1;
    if ( size < 1 ) size = 1;
    Coordinate center = ( dimIndex >= 0 && dimIndex < (Index) pos.size() )
      ? pos[dimIndex] : Coordinate( 0 );

    auto inner = [&]() -> std::vector<Number> {
      if ( dimIndex > dimension )
        return sampleCombineAxis( buffer, pos, dimIndex - 1, dimension, length,
          filter, edges, footprint, pixelCoordinates );
      std::vector<Number> out( length, Number( 0 ) );
      sampleReadChannels( buffer, pos, length, out );
      return out;
    };

    // MINIFY fold (mean/min/max/add): point-sample the footprint's taps and reduce.
    if ( sampleIsFold( op ) && fp > Coordinate( 1 ) + coordEpsilon ) {
      Coordinate floored = NumberOps<Coordinate>::floor( fp - coordEpsilon );
      int taps = (int) floored;
      if ( floored < fp - coordEpsilon ) taps++;
      if ( taps < 1 ) taps = 1;
      if ( taps > MAX_TAPS ) taps = MAX_TAPS;
      Coordinate fpStep = pixelCoordinates ? fp : fp / Coordinate( size );
      bool isMin = ( op == SampleOpt::Min ), isMax = ( op == SampleOpt::Max );
      Number init = isMin ? NumberOps<Number>::infinity()
                          : isMax ? -NumberOps<Number>::infinity() : Number( 0 );
      std::vector<Number> acc( (size_t) length, init );
      for ( int t = 0; t < taps; t++ ) {
        Coordinate offset = taps > 1
          ? NumberOps<Coordinate>::ratio( 2 * t + 1, 2 * taps )
            - NumberOps<Coordinate>::ratio( 1, 2 )
          : Coordinate( 0 );
        if ( dimIndex >= 0 ) pos[dimIndex] = resolveAxis(
          center + fpStep * offset, size, SampleOpt::Nearest, edge,
          pixelCoordinates
        ).index0;
        std::vector<Number> s = inner();
        for ( Index i = 0; i < length; i++ ) {
          if ( isMin ) acc[i] = std::min( acc[i], s[i] );
          else if ( isMax ) acc[i] = std::max( acc[i], s[i] );
          else acc[i] += s[i];
        }
      }
      std::vector<Number> out( (size_t) length );
      if ( op == SampleOpt::Mean )
        for ( Index i = 0; i < length; i++ ) out[i] = acc[i] / Number( taps );
      else
        for ( Index i = 0; i < length; i++ ) out[i] = acc[i];
      return out;
    }

    // linear lerps; nearest (and a fold op when magnifying) point-samples the centre.
    if ( op != SampleOpt::Linear ) {
      if ( dimIndex >= 0 ) pos[dimIndex] = resolveAxis(
        center, size, SampleOpt::Nearest, edge, pixelCoordinates
      ).index0;
      return inner();
    }
    ResolvedAxisT<Coordinate> r = resolveAxis(
      center, size, SampleOpt::Linear, edge, pixelCoordinates
    );
    if ( dimIndex >= 0 ) pos[dimIndex] = r.index0;
    std::vector<Number> sampA = inner();
    if ( r.fraction == 0 || r.index0 == r.index1 ) return sampA;
    if ( dimIndex >= 0 ) pos[dimIndex] = r.index1;
    std::vector<Number> sampB = inner();
    for ( Index i = 0; i < length; i++ )
      sampA[i] = sampleWeighted( sampA[i], Coordinate( 1 ) - r.fraction )
        + sampleWeighted( sampB[i], r.fraction );
    return sampA;
  }

  // Sample `buffer` at `position` with the per-axis `filter` op (linear/nearest
  // point, or mean/min/max/add footprint fold) + `edges` + per-axis `footprint`.
  // Returns one value per channel.
  template <class T>
  inline std::vector<typename T::Number> Sample(
      MatrixBaseT<T> *buffer, std::vector<typename T::Coordinate> position,
      Index dimension = 0, const std::vector<String> &filter = {},
      const std::vector<String> &edges = {},
      const std::vector<typename T::Coordinate> &footprint = {},
      bool pixelCoordinates = false ) {
    using Number = typename T::Number;
    Index channels = 1;
    for ( Index d = 0; d < dimension && d < (Index) buffer->dim.size(); d++ )
      channels *= buffer->dim[d];
    if ( channels < 1 ) channels = 1;

    if ( position.empty() ) {
      std::vector<Number> out( channels, Number( 0 ) );
      sampleReadChannels( buffer, position, channels, out );
      return out;
    }

    return sampleCombineAxis( buffer, position, (Index) position.size() - 1,
        dimension, channels, filter, edges, footprint, pixelCoordinates );
  }

}; // namespace ggg
#endif
