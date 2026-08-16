#pragma once

#include "../Config.h"
#include "./ScaledNumber.h"
#include "./NumberOps.h"

//
// GLSL-style scalar math over ScaledNumber (fixed-point). These are free
// functions in namespace ggg so that ADL finds them for a ScaledNumber argument
// -- which is how a vector/swizzle library that calls unqualified sin(x),
// mix(a,b,t), floor(x)... on a ScaledNumber element resolves them without
// depending on this header. Everything is integer-only (no float seam), so it
// works on an FPU-less target and in a fixed-only build.
//
// Accuracy is kernel-specific rather than IEEE parity. Circular trig uses an
// integer-only CORDIC kernel with enough iterations to reach the destination
// format's raw precision.
//

// Arduino exposes these GLSL names as function-like macros. They cannot coexist
// with overloads (even a qualified ggg::radians(value) call is macro-expanded),
// so prefer the type-safe fixed-point functions in this header.
#ifdef radians
  #undef radians
#endif
#ifdef degrees
  #undef degrees
#endif

namespace ggg {

  // Shorthand: every function is templated on the four ScaledNumber params and
  // works on N = ScaledNumber<R,S,W,F>.
  #define GGG_SN template <class R, std::int64_t S, class W, bool F>
  #define GGG_N  ScaledNumber<R, S, W, F>

  // --- exact / algebraic --------------------------------------------------
  GGG_SN GGG_N abs( GGG_N v )   { return v.raw() < 0 ? -v : v; }
  GGG_SN GGG_N floor( GGG_N v ) { return NumberOps<GGG_N>::floor( v ); }
  GGG_SN GGG_N ceil( GGG_N v )  { return -NumberOps<GGG_N>::floor( -v ); }
  GGG_SN GGG_N trunc( GGG_N v ) { return v.raw() < 0 ? ceil( v ) : floor( v ); }
  GGG_SN GGG_N fract( GGG_N v ) { return v - floor( v ); }
  GGG_SN GGG_N sign( GGG_N v )  { return GGG_N( v.raw() > 0 ? 1 : v.raw() < 0 ? -1 : 0 ); }

  GGG_SN GGG_N mod( GGG_N a, GGG_N b ) { return a - b * floor( a / b ); }

  GGG_SN GGG_N min( GGG_N a, GGG_N b ) { return a < b ? a : b; }
  GGG_SN GGG_N max( GGG_N a, GGG_N b ) { return a < b ? b : a; }
  GGG_SN GGG_N clamp( GGG_N x, GGG_N lo, GGG_N hi ) { return min( max( x, lo ), hi ); }

  GGG_SN GGG_N mix( GGG_N a, GGG_N b, GGG_N t ) { return a + ( b - a ) * t; }
  GGG_SN GGG_N step( GGG_N edge, GGG_N x ) { return GGG_N( x < edge ? 0 : 1 ); }
  GGG_SN GGG_N smoothstep( GGG_N e0, GGG_N e1, GGG_N x ) {
    GGG_N t = clamp( ( x - e0 ) / ( e1 - e0 ), GGG_N( 0 ), GGG_N( 1 ) );
    return t * t * ( GGG_N( 3 ) - GGG_N( 2 ) * t );
  }

  // --- roots --------------------------------------------------------------
  // Integer square root of a widened value (Newton's method, monotone).
  GGG_SN W ggg_isqrt( W n ) {
    if ( n <= 0 ) return 0;
    W x = n, y = ( x + 1 ) / 2;
    while ( y < x ) { x = y; y = ( x + n / x ) / 2; }
    return x;
  }
  // sqrt(v) with v = raw/S: result_raw = isqrt(raw * S).
  GGG_SN GGG_N sqrt( GGG_N v ) {
    if ( v.raw() <= 0 ) return GGG_N( 0 );
    return GGG_N::fromRaw( ggg_isqrt<R, S, W, F>( static_cast<W>( v.raw() ) * static_cast<W>( S ) ) );
  }
  GGG_SN GGG_N inversesqrt( GGG_N v ) { return GGG_N( 1 ) / sqrt( v ); }
  GGG_SN GGG_N rsqrt( GGG_N v ) { return inversesqrt( v ); }   // GLSL/CxxSwizzle spelling

  #if GGGGX_CORDIC_ENABLE
  // --- circular trig (CORDIC) --------------------------------------------
  //
  // Constants are 30-fractional-bit integer literals generated offline.
  // Scaling them into the destination format is constexpr integer arithmetic,
  // so the firmware contains no floating constants or libm dependency.
  constexpr std::int64_t ggg_cordic_q30_to_raw(
    std::int64_t value, std::int64_t scale
  ) {
    const std::int64_t magnitude = value < 0 ? -value : value;
    const std::int64_t raw =
      ( magnitude * scale + ( std::int64_t( 1 ) << 29 ) ) >> 30;
    return value < 0 ? -raw : raw;
  }

  constexpr std::int64_t ggg_cordic_raw_to_q30(
    std::int64_t value, std::int64_t scale
  ) {
    const std::int64_t magnitude = value < 0 ? -value : value;
    const std::int64_t q30 =
      ( magnitude * ( std::int64_t( 1 ) << 30 ) + scale / 2 ) / scale;
    return value < 0 ? -q30 : q30;
  }

  // Portable arithmetic right shift: floor(value / 2^bits), expressed with
  // unsigned-magnitude shifts so C++17's signed-right-shift rule is irrelevant.
  constexpr std::int64_t ggg_cordic_shift(
    std::int64_t value, unsigned bits
  ) {
    if ( bits == 0 ) return value;
    if ( value >= 0 ) return value >> bits;
    const std::int64_t magnitude = -value;
    return -( ( magnitude + ( ( std::int64_t( 1 ) << bits ) - 1 ) ) >> bits );
  }

  struct CordicQ30 {
    inline static constexpr std::int64_t pi = INT64_C( 3373259426 );
    inline static constexpr std::int64_t halfPi = INT64_C( 1686629713 );
    inline static constexpr std::int64_t tau = INT64_C( 6746518852 );
    inline static constexpr std::int64_t gainInverse = INT64_C( 652032874 );
    inline static constexpr std::int32_t atanTable[] = {
      843314857, 497837829, 263043837, 133525159,
       67021687,  33543516,  16775851,   8388437,
        4194283,   2097149,   1048576,    524288,
         262144,    131072,     65536,     32768,
          16384,      8192,      4096,      2048,
           1024,       512,       256,       128,
    };
  };

  template <std::int64_t Scale>
  struct CordicConstants {
    inline static constexpr std::int64_t piRaw =
      ggg_cordic_q30_to_raw( CordicQ30::pi, Scale );
    inline static constexpr std::int64_t halfPiRaw =
      ggg_cordic_q30_to_raw( CordicQ30::halfPi, Scale );
    inline static constexpr std::int64_t tauRaw =
      ggg_cordic_q30_to_raw( CordicQ30::tau, Scale );
  };

  template <typename N>
  struct CordicSinCos {
    N sin;
    N cos;
  };

  GGG_SN CordicSinCos<GGG_N> ggg_cordic_sincos( GGG_N angle ) {
    using I = std::int64_t;
    static_assert( sizeof( R ) <= sizeof( std::int32_t ),
      "fixed CORDIC currently supports representations up to 32 bits" );

    I z = ggg_cordic_raw_to_q30( static_cast<I>( angle.raw() ), S )
      % CordicQ30::tau;
    if ( z > CordicQ30::pi ) z -= CordicQ30::tau;
    else if ( z < -CordicQ30::pi ) z += CordicQ30::tau;

    I quadrantSign = 1;
    if ( z > CordicQ30::halfPi ) {
      z -= CordicQ30::pi;
      quadrantSign = -1;
    } else if ( z < -CordicQ30::halfPi ) {
      z += CordicQ30::pi;
      quadrantSign = -1;
    }

    // Exact axes avoid the small residual a finite CORDIC rotation otherwise
    // leaves at 0, +/-pi/2, and +/-pi.
    if ( z == 0 )
      return { GGG_N::fromRaw( 0 ), GGG_N::fromRaw( quadrantSign * S ) };
    if ( z == CordicQ30::halfPi )
      return { GGG_N::fromRaw( quadrantSign * S ), GGG_N::fromRaw( 0 ) };
    if ( z == -CordicQ30::halfPi )
      return { GGG_N::fromRaw( -quadrantSign * S ), GGG_N::fromRaw( 0 ) };

    I x = CordicQ30::gainInverse;
    I y = 0;
    for ( unsigned i = 0;
          i < sizeof( CordicQ30::atanTable ) / sizeof( CordicQ30::atanTable[0] );
          i++ ) {
      const I step = CordicQ30::atanTable[i];
      const I oldX = x;
      const I oldY = y;
      if ( z >= 0 ) {
        x = oldX - ggg_cordic_shift( oldY, i );
        y = oldY + ggg_cordic_shift( oldX, i );
        z -= step;
      } else {
        x = oldX + ggg_cordic_shift( oldY, i );
        y = oldY - ggg_cordic_shift( oldX, i );
        z += step;
      }
    }

    return {
      GGG_N::fromRaw( static_cast<W>(
        ggg_cordic_q30_to_raw( quadrantSign * y, S )
      ) ),
      GGG_N::fromRaw( static_cast<W>(
        ggg_cordic_q30_to_raw( quadrantSign * x, S )
      ) ),
    };
  }

  GGG_SN GGG_N sin( GGG_N x ) { return ggg_cordic_sincos( x ).sin; }
  GGG_SN GGG_N cos( GGG_N x ) { return ggg_cordic_sincos( x ).cos; }
  GGG_SN GGG_N tan( GGG_N x ) {
    CordicSinCos<GGG_N> pair = ggg_cordic_sincos( x );
    return pair.sin / pair.cos;
  }

  GGG_SN GGG_N atan2( GGG_N yValue, GGG_N xValue ) {
    using I = std::int64_t;
    using C = CordicConstants<S>;
    static_assert( sizeof( R ) <= sizeof( std::int32_t ),
      "fixed CORDIC currently supports representations up to 32 bits" );

    I x = static_cast<I>( xValue.raw() );
    I y = static_cast<I>( yValue.raw() );
    if ( y == 0 ) return GGG_N::fromRaw( x < 0 ? C::piRaw : 0 );
    if ( x == 0 )
      return GGG_N::fromRaw( y > 0 ? C::halfPiRaw : -C::halfPiRaw );

    I z = 0;
    if ( x < 0 ) {
      const bool upperHalf = y > 0;
      x = -x;
      y = -y;
      z = upperHalf ? CordicQ30::pi : -CordicQ30::pi;
    }

    // Vectoring accuracy depends on significant bits in x/y, not their absolute
    // magnitude. Normalize small vectors before the shift/add iterations.
    I magnitude = x < 0 ? -x : x;
    const I absY = y < 0 ? -y : y;
    if ( absY > magnitude ) magnitude = absY;
    while ( magnitude < ( I( 1 ) << 30 ) ) {
      x *= 2;
      y *= 2;
      magnitude *= 2;
    }

    for ( unsigned i = 0;
          i < sizeof( CordicQ30::atanTable ) / sizeof( CordicQ30::atanTable[0] );
          i++ ) {
      const I step = CordicQ30::atanTable[i];
      const I oldX = x;
      const I oldY = y;
      if ( oldY > 0 ) {
        x = oldX + ggg_cordic_shift( oldY, i );
        y = oldY - ggg_cordic_shift( oldX, i );
        z += step;
      } else {
        x = oldX - ggg_cordic_shift( oldY, i );
        y = oldY + ggg_cordic_shift( oldX, i );
        z -= step;
      }
    }
    return GGG_N::fromRaw( static_cast<W>(
      ggg_cordic_q30_to_raw( z, S )
    ) );
  }

  GGG_SN GGG_N atan( GGG_N x ) {
    return atan2( x, GGG_N( 1 ) );
  }
  GGG_SN GGG_N atan( GGG_N y, GGG_N x ) {
    return atan2( y, x );
  }
  #endif


  // --- circular trig via a 256-entry Q15 lookup + linear interp -----------
  // Range reduction is one modulo + one divide; then two table reads and a
  // lerp -- a small fraction of the 24-round int64 CORDIC's cost, at ~1.4e-4
  // (Q16.16). The table is integer (Q15), so the firmware carries no floating
  // constants. Self-contained: tau/pi come from NumberOps, not the CORDIC block.
  struct SinLutQ15 {
    static const int Bits = 8;
    static const int Size = 1 << Bits;   // entries per cycle (power of two)
    inline static constexpr std::int16_t table[Size + 1] = {
           0,    804,   1608,   2410,   3212,   4011,   4808,   5602,   6393,   7179,   7962,   8739,   9512,  10278,  11039,  11793,
       12539,  13279,  14010,  14732,  15446,  16151,  16846,  17530,  18204,  18868,  19519,  20159,  20787,  21403,  22005,  22594,
       23170,  23731,  24279,  24811,  25329,  25832,  26319,  26790,  27245,  27683,  28105,  28510,  28898,  29268,  29621,  29956,
       30273,  30571,  30852,  31113,  31356,  31580,  31785,  31971,  32137,  32285,  32412,  32521,  32609,  32678,  32728,  32757,
       32767,  32757,  32728,  32678,  32609,  32521,  32412,  32285,  32137,  31971,  31785,  31580,  31356,  31113,  30852,  30571,
       30273,  29956,  29621,  29268,  28898,  28510,  28105,  27683,  27245,  26790,  26319,  25832,  25329,  24811,  24279,  23731,
       23170,  22594,  22005,  21403,  20787,  20159,  19519,  18868,  18204,  17530,  16846,  16151,  15446,  14732,  14010,  13279,
       12539,  11793,  11039,  10278,   9512,   8739,   7962,   7179,   6393,   5602,   4808,   4011,   3212,   2410,   1608,    804,
           0,   -804,  -1608,  -2410,  -3212,  -4011,  -4808,  -5602,  -6393,  -7179,  -7962,  -8739,  -9512, -10278, -11039, -11793,
      -12539, -13279, -14010, -14732, -15446, -16151, -16846, -17530, -18204, -18868, -19519, -20159, -20787, -21403, -22005, -22594,
      -23170, -23731, -24279, -24811, -25329, -25832, -26319, -26790, -27245, -27683, -28105, -28510, -28898, -29268, -29621, -29956,
      -30273, -30571, -30852, -31113, -31356, -31580, -31785, -31971, -32137, -32285, -32412, -32521, -32609, -32678, -32728, -32757,
      -32767, -32757, -32728, -32678, -32609, -32521, -32412, -32285, -32137, -31971, -31785, -31580, -31356, -31113, -30852, -30571,
      -30273, -29956, -29621, -29268, -28898, -28510, -28105, -27683, -27245, -26790, -26319, -25832, -25329, -24811, -24279, -23731,
      -23170, -22594, -22005, -21403, -20787, -20159, -19519, -18868, -18204, -17530, -16846, -16151, -15446, -14732, -14010, -13279,
      -12539, -11793, -11039, -10278,  -9512,  -8739,  -7962,  -7179,  -6393,  -5602,  -4808,  -4011,  -3212,  -2410,  -1608,   -804,
           0
    };
  };

  GGG_SN GGG_N sinLut( GGG_N a ) {
    static const std::int64_t tauRaw = static_cast<std::int64_t>( NumberOps<GGG_N>::tau().raw() );
    std::int64_t raw = static_cast<std::int64_t>( a.raw() ) % tauRaw;
    if ( raw < 0 ) raw += tauRaw;
    const std::int64_t SUB = 4096;                                  // interp resolution
    const std::int64_t pos = raw * ( (std::int64_t) SinLutQ15::Size * SUB ) / tauRaw;
    const int idx = (int) ( ( pos / SUB ) & ( SinLutQ15::Size - 1 ) );
    const std::int64_t frac = pos % SUB;
    const std::int64_t A = SinLutQ15::table[idx];
    const std::int64_t B = SinLutQ15::table[idx + 1];
    const std::int64_t q15 = A + ( B - A ) * frac / SUB;            // Q15
    return GGG_N::fromRaw( static_cast<W>( q15 * S / 32768 ) );     // Q15 -> this format
  }
  GGG_SN GGG_N cosLut( GGG_N a ) {
    static const GGG_N halfPi = NumberOps<GGG_N>::pi() / GGG_N( 2 );
    return sinLut( a + halfPi );
  }

  GGG_SN GGG_N radians( GGG_N d ) { return d * NumberOps<GGG_N>::pi() / GGG_N( 180 ); }
  GGG_SN GGG_N degrees( GGG_N r ) { return r * GGG_N( 180 ) / NumberOps<GGG_N>::pi(); }

  // --- exp / log ----------------------------------------------------------
  // exp2(x) = 2^x. Split x = i + f (i integral, f in [0,1)); 2^f via a cubic,
  // 2^i by shifting the raw representation (saturating, format-agnostic).
  GGG_SN GGG_N exp2( GGG_N x ) {
    GGG_N i = floor( x );
    GGG_N f = x - i;                                   // [0,1)
    const GGG_N A = GGG_N::fromRatio( 6931472, 10000000 );   // ln2
    const GGG_N B = GGG_N::fromRatio( 2402265, 10000000 );
    const GGG_N C = GGG_N::fromRatio(  555041, 10000000 );
    GGG_N p = GGG_N( 1 ) + f * ( A + f * ( B + f * C ) );    // 2^f, ~3e-4
    int ii = (int) i;
    W r = static_cast<W>( p.raw() );
    if ( ii >= 0 ) {
      for ( int k = 0; k < ii; k++ ) {
        if ( r > ( std::numeric_limits<W>::max() >> 1 ) ) { r = std::numeric_limits<W>::max(); break; }
        r <<= 1;
      }
    } else {
      for ( int k = 0; k < -ii && r != 0; k++ ) r >>= 1;
    }
    return GGG_N::fromRaw( r );
  }

  // log2(x) = log2(raw) - log2(Scale). log2(raw) = MSB index + log2(mantissa),
  // mantissa in [1,2). Scale is a power of two so log2(Scale) is exact.
  GGG_SN GGG_N log2( GGG_N x ) {
    if ( x.raw() <= 0 ) return GGG_N( 0 );             // undefined; clamp
    W raw = static_cast<W>( x.raw() );
    int p = 0;
    for ( W t = raw; t > 1; t >>= 1 ) p++;             // floor(log2(raw))
    int ls = 0;
    for ( W s = static_cast<W>( S ); s > 1; s >>= 1 ) ls++;   // log2(Scale)
    GGG_N m = GGG_N::fromRaw( ( raw * static_cast<W>( S ) ) >> p );  // mantissa [1,2)
    GGG_N u = m - GGG_N( 1 );                          // [0,1)
    const GGG_N C1 = GGG_N::fromRatio( 14426950, 10000000 );
    const GGG_N C2 = GGG_N::fromRatio( -7213475, 10000000 );
    const GGG_N C3 = GGG_N::fromRatio(  4808983, 10000000 );
    GGG_N logm = u * ( C1 + u * ( C2 + u * C3 ) );     // log2(1+u), ~2e-2
    return GGG_N( p - ls ) + logm;
  }

  GGG_SN GGG_N exp( GGG_N x ) { return exp2( x * GGG_N::fromRatio( 14426950, 10000000 ) ); } // *log2(e)
  GGG_SN GGG_N log( GGG_N x ) { return log2( x ) * GGG_N::fromRatio( 6931472, 10000000 ); }   // *ln2
  GGG_SN GGG_N pow( GGG_N x, GGG_N y ) {
    if ( x.raw() <= 0 ) return GGG_N( 0 );
    return exp2( y * log2( x ) );
  }

  #undef GGG_SN
  #undef GGG_N

} // namespace ggg
