#pragma once

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
// Accuracy target is "good enough for shader visuals" (~1e-3), not IEEE parity.
// sin/cos use a Bhaskara-style rational approximation after range reduction.
//

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

  // --- trig ---------------------------------------------------------------
  // sin on [0, pi] via Bhaskara I: 16a(pi-a) / (5pi^2 - 4a(pi-a)). Odd-extended
  // and range-reduced to [-pi, pi]. Max error ~1.6e-3.
  GGG_SN GGG_N sin( GGG_N x ) {
    const GGG_N pi  = NumberOps<GGG_N>::pi();
    const GGG_N tau = NumberOps<GGG_N>::tau();
    GGG_N r = mod( x + pi, tau ) - pi;          // r in [-pi, pi)
    GGG_N s = r.raw() < 0 ? GGG_N( -1 ) : GGG_N( 1 );
    GGG_N a = abs( r );                          // [0, pi]
    GGG_N ap = a * ( pi - a );
    GGG_N num = GGG_N( 16 ) * ap;
    GGG_N den = GGG_N( 5 ) * pi * pi - GGG_N( 4 ) * ap;
    return s * ( num / den );
  }
  GGG_SN GGG_N cos( GGG_N x ) {
    const GGG_N pi = NumberOps<GGG_N>::pi();
    return sin( x + pi / GGG_N( 2 ) );
  }
  GGG_SN GGG_N tan( GGG_N x ) { return sin( x ) / cos( x ); }

  GGG_SN GGG_N radians( GGG_N d ) { return d * NumberOps<GGG_N>::pi() / GGG_N( 180 ); }
  GGG_SN GGG_N degrees( GGG_N r ) { return r * GGG_N( 180 ) / NumberOps<GGG_N>::pi(); }

  #undef GGG_SN
  #undef GGG_N

} // namespace ggg
