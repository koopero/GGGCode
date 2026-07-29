#include <unity.h>
#include <string>
#include <cstring>
#include <cstdlib>
#include <vector>
#include <type_traits>
#include "Normal.h"
#include "Matrix.h"
#include "ggg.h"
#include "Print.h"
#include "MatrixCommands.h"
#include "DocCommands.h"
#include "FlowCommands.h"
#include "Sample.h"
#include "Blit.h"
#include "ggg/ScaledMath.h"
#include "gen/conformance_cases.h"

// Test functions
void test_norm_compare() {
  float OneA = 1;
  float TwoA = 2;
  NormalizedNumber<int16_t, 400, int32_t> OneB(1);
  NormalizedNumber<uint8_t, 200, int32_t> OneC(1);
  NormalizedNumber<int16_t, 400, int32_t> TwoB(2);
  NormalizedNumber<uint8_t, 200, int32_t> TwoC(2);
  
  TEST_ASSERT( OneA == OneA );
  TEST_ASSERT( OneA == OneB );
  TEST_ASSERT( OneA == OneC );
  TEST_ASSERT( OneB == OneA );
  TEST_ASSERT( OneB == OneB );
  TEST_ASSERT( OneB == OneC );
  TEST_ASSERT( OneC == OneA );
  TEST_ASSERT( OneC == OneB );
  TEST_ASSERT( OneC == OneC );

  TEST_ASSERT( OneA != TwoA );
  TEST_ASSERT( OneA != TwoB );
  TEST_ASSERT( OneA != TwoC );
  TEST_ASSERT( OneB != TwoA );
  TEST_ASSERT( OneB != TwoB );
  TEST_ASSERT( OneB != TwoC );
  TEST_ASSERT( OneC != TwoA );
  TEST_ASSERT( OneC != TwoB );
  TEST_ASSERT( OneC != TwoC );

  TEST_ASSERT( TwoA > OneA );
  TEST_ASSERT( TwoA > OneB );
  TEST_ASSERT( TwoA > OneB );
  TEST_ASSERT( TwoB > OneA );
  TEST_ASSERT( TwoB > OneB );
  TEST_ASSERT( TwoB > OneC );
  TEST_ASSERT( TwoC > OneA );
  TEST_ASSERT( TwoC > OneB );
  TEST_ASSERT( TwoC > OneC );

  TEST_ASSERT( TwoA >= OneA );
  TEST_ASSERT( TwoA >= OneB );
  TEST_ASSERT( TwoA >= OneB );
  TEST_ASSERT( TwoB >= OneA );
  TEST_ASSERT( TwoB >= OneB );
  TEST_ASSERT( TwoB >= OneC );
  TEST_ASSERT( TwoC >= OneA );
  TEST_ASSERT( TwoC >= OneB );
  TEST_ASSERT( TwoC >= OneC );
  TEST_ASSERT( OneA >= OneA );
  TEST_ASSERT( OneA >= OneB );
  TEST_ASSERT( OneA >= OneB );
  TEST_ASSERT( OneB >= OneA );
  TEST_ASSERT( OneB >= OneB );
  TEST_ASSERT( OneB >= OneC );
  TEST_ASSERT( OneC >= OneA );
  TEST_ASSERT( OneC >= OneB );
  TEST_ASSERT( OneC >= OneC );

  TEST_ASSERT( OneA < TwoA );
  TEST_ASSERT( OneA < TwoB );
  TEST_ASSERT( OneA < TwoB );
  TEST_ASSERT( OneB < TwoA );
  TEST_ASSERT( OneB < TwoB );
  TEST_ASSERT( OneB < TwoC );
  TEST_ASSERT( OneC < TwoA );
  TEST_ASSERT( OneC < TwoB );
  TEST_ASSERT( OneC < TwoC );

  TEST_ASSERT( OneA <= TwoA );
  TEST_ASSERT( OneA <= TwoB );
  TEST_ASSERT( OneA <= TwoB );
  TEST_ASSERT( OneB <= TwoA );
  TEST_ASSERT( OneB <= TwoB );
  TEST_ASSERT( OneB <= TwoC );
  TEST_ASSERT( OneC <= TwoA );
  TEST_ASSERT( OneC <= TwoB );
  TEST_ASSERT( OneC <= TwoC );
  TEST_ASSERT( OneA <= OneA );
  TEST_ASSERT( OneA <= OneB );
  TEST_ASSERT( OneA <= OneB );
  TEST_ASSERT( OneB <= OneA );
  TEST_ASSERT( OneB <= OneB );
  TEST_ASSERT( OneB <= OneC );
  TEST_ASSERT( OneC <= OneA );
  TEST_ASSERT( OneC <= OneB );
  TEST_ASSERT( OneC <= OneC );
}



// Test functions
void test_matrix_int() {
  auto mat1 = ggg::MatrixStatic<int, false, ggg::FloatTraits>({2, 2, 2});
  mat1.allocate();
  mat1.write( { 100, 200, 300 } );
  mat1.write( 333, 2 );
  mat1.write( 444, { 1, 1 } );
  mat1.write( {5, 6, 7 }, { 0,0,1} );

  TEST_ASSERT_EQUAL_INT(8, mat1.size);
  TEST_ASSERT_EQUAL_INT(100, mat1.readNumber({0, 0}));
  TEST_ASSERT_EQUAL_INT(200, mat1.readNumber({1, 0}));
  TEST_ASSERT_EQUAL_INT(333, mat1.readNumber({0, 1}));
  TEST_ASSERT_EQUAL_INT(444, mat1.readNumber({1, 1}));
  TEST_ASSERT_EQUAL_INT(5, mat1.readNumber({0, 0, 1}));
}

void test_matrix_norm() {
  auto mat1 =
    ggg::MatrixStatic<NormalizedNumber<int16_t, 100, int32_t>, false, ggg::FloatTraits>(
      {2, 2, 2}
    );
  mat1.allocate();
  mat1.write( { 10, 20, 30 } );
  mat1.write( 33, 2 );
  mat1.write( 44, { 1, 1 } );
  mat1.write( {0.5, 0.6, -0.7 }, { 0,0,1} );
  mat1.write( 100000, { 1,1,1 } );

  TEST_ASSERT_EQUAL_INT(8, mat1.size);
  TEST_ASSERT_EQUAL_INT(10, mat1.readNumber(0));
  TEST_ASSERT_EQUAL_INT(20, mat1.readNumber(1));
  TEST_ASSERT_EQUAL_INT(33, mat1.readNumber({0, 1}));
  TEST_ASSERT_EQUAL_INT(44, mat1.readNumber({1, 1}));
  TEST_ASSERT_EQUAL_FLOAT(0.5, mat1.readNumber({0, 0, 1}));
  TEST_ASSERT_EQUAL_FLOAT(0.6, mat1.readNumber({1, 0, 1}));
  TEST_ASSERT_EQUAL_FLOAT(-0.7, mat1.readNumber({0, 1, 1}));

  // Clamping
  TEST_ASSERT_EQUAL_FLOAT( 327.67, mat1.readNumber({1, 1, 1}));

}

// A minimal duck-typed vector (num_of_components + operator[]) standing in for a
// caller's swizzle vecN, to exercise Matrix::read/writeVec without pulling a
// vector library into GGG.
template <int N>
struct TestVec {
  static const int num_of_components = N;
  float v[N];
  TestVec() { for ( int i = 0; i < N; i++ ) v[i] = 0; }
  float & operator[]( int i ) { return v[i]; }
  const float & operator[]( int i ) const { return v[i]; }
};

void test_matrix_vec() {
  // dim[0] = 3 components, dim[1] = 2 cells -> size 6.
  auto m = ggg::Matrix<float, false, ggg::FloatTraits>( {3, 2} );
  m.allocate();

  TestVec<3> a; a[0] = 1; a[1] = 2; a[2] = 3;
  TEST_ASSERT_EQUAL_INT( 3, m.writeIndexVec( a, 0 ) );   // cell 0 first component at index 0
  TestVec<3> b; b[0] = 4; b[1] = 5; b[2] = 6;
  m.writeVec( b, 1 );                                     // cell 1 base = 1*3 = 3

  TEST_ASSERT_EQUAL_FLOAT( 1, m.readNumber( 0 ) );
  TEST_ASSERT_EQUAL_FLOAT( 6, m.readNumber( 5 ) );

  TestVec<3> r = m.readIndexVec<TestVec<3>>( 0 );
  TEST_ASSERT_EQUAL_FLOAT( 1, r[0] );
  TEST_ASSERT_EQUAL_FLOAT( 3, r[2] );

  TestVec<3> r2 = m.readVec<TestVec<3>>( 1 );             // cell 1
  TEST_ASSERT_EQUAL_FLOAT( 4, r2[0] );
  TEST_ASSERT_EQUAL_FLOAT( 6, r2[2] );

  // Scalar overload (read): a single component (arithmetic type).
  float sc = m.readIndexVec<float>( 5 );
  TEST_ASSERT_EQUAL_FLOAT( 6, sc );

  // Wider V than the matrix has components: the extra lane is left untouched.
  TestVec<4> wide; wide[3] = 99;
  wide = m.readIndexVec<TestVec<4>>( 0, wide );
  TEST_ASSERT_EQUAL_FLOAT( 1, wide[0] );
  TEST_ASSERT_EQUAL_FLOAT( 3, wide[2] );
  TEST_ASSERT_EQUAL_FLOAT( 99, wide[3] );

  // Scalar overload (write): mutates a single component -- done last so it does
  // not disturb the reads above.
  m.writeVec( 7.0f, 0 );                                  // cell 0, component 0
  TEST_ASSERT_EQUAL_FLOAT( 7, m.readNumber( 0 ) );

  // Storage != caller element type: a normalized-int16 matrix round-trips via
  // float lanes, proving the accessor is storage-agnostic (converts through the
  // element assignment, not a raw copy).
  auto mn = ggg::Matrix<NormalizedNumber<int16_t, 100, int32_t>, false, ggg::FloatTraits>( {2, 1} );
  mn.allocate();
  TestVec<2> nv; nv[0] = 0.5; nv[1] = -0.25;
  mn.writeIndexVec( nv, 0 );
  TestVec<2> nr = mn.readIndexVec<TestVec<2>>( 0 );
  TEST_ASSERT_EQUAL_FLOAT( 0.5, nr[0] );
  TEST_ASSERT_EQUAL_FLOAT( -0.25, nr[1] );
}



void test_fixed_presets() {
  using ggg::FixedQ8_8;
  using ggg::FixedQ24_8;

  // Q8.8 matrix: 1.0 -> raw 256.
  auto m = ggg::Matrix<FixedQ8_8, false, ggg::FixedQ8_8Traits>( {1, 3} );
  m.allocate();
  m.write( { 1, 2, 3 } );
  TEST_ASSERT_EQUAL_INT( 256, m.readNumber( 0 ).raw() );
  TEST_ASSERT_EQUAL_INT( 768, m.readNumber( 2 ).raw() );

  // Arithmetic + decimal rendering through NumberOps (no float involved).
  FixedQ8_8 half = FixedQ8_8( 3 ) / FixedQ8_8( 2 );          // 1.5 -> raw 384
  TEST_ASSERT_EQUAL_INT( 384, half.raw() );
  TEST_ASSERT_EQUAL_STRING( "1.5", ggg::NumberOps<FixedQ8_8>::format( half ).c_str() );
  const FixedQ8_8 q8pi = ggg::NumberOps<FixedQ8_8>::pi();
  TEST_ASSERT_INT_WITHIN( 1, 181, ggg::sin( q8pi / FixedQ8_8( 4 ) ).raw() );

  // Q24.8: same 8 fractional bits, wider whole range (int32).
  FixedQ24_8 big = FixedQ24_8( 1000 ) + FixedQ24_8( 1 ) / FixedQ24_8( 4 );  // 1000.25
  TEST_ASSERT_EQUAL_STRING( "1000.25", ggg::NumberOps<FixedQ24_8>::format( big ).c_str() );
}

void test_fixed_math() {
  using Q = ggg::FixedQ16_16;
  const long ONE = 65536;

  // Algebraic (exact).
  TEST_ASSERT_EQUAL_INT( ONE,     ggg::floor( Q(3) / Q(2) ).raw() );      // floor(1.5)=1
  TEST_ASSERT_EQUAL_INT( ONE / 2, ggg::fract( Q(3) / Q(2) ).raw() );      // 0.5
  TEST_ASSERT_EQUAL_INT( 2 * ONE, ggg::abs( Q(-2) ).raw() );
  TEST_ASSERT_EQUAL_INT( -ONE,    ggg::sign( Q(-5) ).raw() );
  TEST_ASSERT_EQUAL_INT( 2 * ONE, ggg::mod( Q(5), Q(3) ).raw() );
  TEST_ASSERT_EQUAL_INT( ONE,     ggg::clamp( Q(5), Q(0), Q(1) ).raw() );
  TEST_ASSERT_EQUAL_INT( 5 * ONE, ggg::mix( Q(0), Q(10), Q(1) / Q(2) ).raw() );
  TEST_ASSERT_EQUAL_INT( ONE / 2, ggg::smoothstep( Q(0), Q(1), Q(1) / Q(2) ).raw() );

  // sqrt.
  TEST_ASSERT_EQUAL_INT( 2 * ONE, ggg::sqrt( Q(4) ).raw() );
  TEST_ASSERT_INT_WITHIN( 8, 92682, ggg::sqrt( Q(2) ).raw() );           // 1.41421 * 65536

  // Circular trig (integer CORDIC). Q16.16 should stay within the shared
  // conformance epsilon (about 7 raw units).
  const Q pi = ggg::NumberOps<Q>::pi();
  const Q quarterPi = pi / Q( 4 );
  TEST_ASSERT_INT_WITHIN( 7, ONE, ggg::sin( pi / Q(2) ).raw() );
  TEST_ASSERT_INT_WITHIN( 7, 0,   ggg::sin( Q(0) ).raw() );
  TEST_ASSERT_INT_WITHIN( 7, ONE, ggg::cos( Q(0) ).raw() );
  TEST_ASSERT_INT_WITHIN( 7, 0,   ggg::sin( pi ).raw() );
  TEST_ASSERT_INT_WITHIN( 7, 46341, ggg::sin( quarterPi ).raw() );
  TEST_ASSERT_INT_WITHIN( 7, quarterPi.raw(), ggg::atan( Q(1) ).raw() );
  TEST_ASSERT_INT_WITHIN( 7, -quarterPi.raw(), ggg::atan( Q(-1) ).raw() );
  TEST_ASSERT_INT_WITHIN( 7, 3 * quarterPi.raw(), ggg::atan2( Q(1), Q(-1) ).raw() );
  TEST_ASSERT_INT_WITHIN( 7, -3 * quarterPi.raw(), ggg::atan2( Q(-1), Q(-1) ).raw() );
  TEST_ASSERT_INT_WITHIN( 7, pi.raw(), ggg::atan2( Q(0), Q(-1) ).raw() );

  // exp2 / log2 at exact (power-of-two) points -> tight; derived exp/log/pow.
  TEST_ASSERT_INT_WITHIN( 16, 8 * ONE, ggg::exp2( Q(3) ).raw() );
  TEST_ASSERT_INT_WITHIN( 16, ONE,     ggg::exp2( Q(0) ).raw() );
  TEST_ASSERT_INT_WITHIN( 16, 3 * ONE, ggg::log2( Q(8) ).raw() );
  TEST_ASSERT_INT_WITHIN( 16, 0,       ggg::log2( Q(1) ).raw() );
  TEST_ASSERT_INT_WITHIN( 64, 1024 * ONE, ggg::pow( Q(2), Q(10) ).raw() );  // 2^10
  TEST_ASSERT_INT_WITHIN( 16, ONE, ggg::exp( Q(0) ).raw() );   // exp(0)=1
  TEST_ASSERT_INT_WITHIN( 16, 0,   ggg::log( Q(1) ).raw() );   // log(1)=0
  // exp2(0.5) = sqrt(2) ~ 1.41421 (poly, looser).
  TEST_ASSERT_INT_WITHIN( 400, 92682, ggg::exp2( Q(1) / Q(2) ).raw() );
}

// Conformance: run each shared corpus program through the machine and compare
// its output to the TS-produced golden (cxx/test-pio/gen/conformance_cases.h,
// generated by ts/cxx/buildConformance.script.ts).
// Templated on the traits so the SAME corpus can be run against more than one
// NumberType. That is the point of the exercise: a config typedef could swap the
// type, but only a second instantiation proves the seam is real.
template <class T>
struct ConformanceMachineT : public ggg::MachineT<T> {
  using Number = typename T::Number;
  using Matrix = ggg::Matrix<Number, false, T>;

  std::string out;
  unsigned subsystemMask =
    ggg_conformance::GGGPX | ggg_conformance::GGGTX |
    ggg_conformance::GGGGX | ggg_conformance::GGGDX;
  void write( const ggg::String &s ) override { out += s; }

  void setupFor( unsigned needs ) {
    subsystemMask = needs;
    setup();
  }

  void setup() override {
    if ( subsystemMask & ggg_conformance::GGGPX ) {
      this->addCommand( new ggg::PrintNumbersT<T>() );
      this->addCommand( new ggg::PrintStringT<T>() );
    }
    if ( subsystemMask & ggg_conformance::GGGTX ) {
      this->addCommand( new ggg::ProcedureInitT<T>() );
      this->addCommand( new ggg::BlockEndT<T>() );
      this->addCommand( new ggg::ProcedureRunT<T>() );
      this->addCommand( new ggg::ConditionalT<T>() );
      this->addCommand( new ggg::AsyncExportT<T>() );
    }
    if ( subsystemMask & ggg_conformance::GGGGX ) {
      this->addCommand( new ggg::MatrixWriteT<T>() );
      this->addCommand( new ggg::MatrixReadT<T>() );
      this->addCommand( new ggg::MatrixBlitT<T>() );
    }
    if ( subsystemMask & ggg_conformance::GGGDX ) {
      this->addCommand( new ggg::LanguageDescriptionT<T>() );
      this->addCommand( new ggg::LanguageBasicsT<T>() );
      this->addCommand( new ggg::CommandsListT<T>() );
      this->addCommand( new ggg::EnumsListT<T>() );
    }
    // A fixed register "r" = [10,20,30] so reference cases ($r) have data.
    auto *reg = new Matrix( {1,3} );
    reg->allocate();
    reg->name = "r";
    reg->writeScalarFloat( 10, 0 );
    reg->writeScalarFloat( 20, 1 );
    reg->writeScalarFloat( 30, 2 );
    this->addRegister( reg );
    // A 2x3 register "m" for offset references ($m@[...]), where the shape (and
    // thus the per-axis strides) is what's under test.
    auto *mat = new Matrix( {2,3} );
    mat->allocate();
    mat->name = "m";
    for ( int i = 0; i < 6; i++ ) mat->writeScalarFloat( 10 + i, i );
    this->addRegister( mat );
    // Blit (G40) fixtures: source "bs" = 3x3 [1..9], destination "bd" = 3x3
    // zeroed (read back via G10 to compare the transform result).
    auto *bs = new Matrix( {3,3} );
    bs->allocate();
    bs->name = "bs";
    for ( int i = 0; i < 9; i++ ) bs->writeScalarFloat( i + 1, i );
    this->addRegister( bs );
    auto *bd = new Matrix( {3,3} );
    bd->allocate();
    bd->name = "bd";
    this->addRegister( bd );
  }
};

using ConformanceMachine = ConformanceMachineT<ggg::DefaultTraits>;

static std::string conformanceStrip( std::string s ) {
  size_t e = s.size();
  while ( e > 0 && s[e-1] == '\n' ) e--;
  return s.substr( 0, e );
}

// Tokenize one output line while honoring quoted strings and comments. This
// prevents numeric-looking source inside a D2 V"..." example from being decoded
// as conformance data.
static std::vector<std::string> outputArgs( const std::string &line ) {
  std::vector<std::string> args;
  std::string arg;
  bool quoted = false, escaped = false;
  for ( char ch : line ) {
    if ( escaped ) {
      arg += ch;
      escaped = false;
    } else if ( quoted && ch == (char) ggg::GGG::Escape ) {
      arg += ch;
      escaped = true;
    } else if ( ch == (char) ggg::GGG::Quote ) {
      arg += ch;
      quoted = !quoted;
    } else if ( !quoted && ch == (char) ggg::GGG::Comment ) {
      break;
    } else if ( !quoted && ( ch == ' ' || ch == '\t' || ch == '\r' ) ) {
      if ( !arg.empty() ) args.push_back( arg );
      arg.clear();
    } else {
      arg += ch;
    }
  }
  if ( !arg.empty() ) args.push_back( arg );
  return args;
}

// Decode a rendered output back into its numeric value stream + control
// responses. Mirrors decodeOutput() in ts/cxx/cases.ts.
struct Decoded { std::vector<float> values; std::vector<std::string> statuses; };

static Decoded decodeOutput( const std::string &text ) {
  Decoded d;
  size_t start = 0;
  while ( true ) {
    size_t nl = text.find( '\n', start );
    std::string line = ( nl == std::string::npos ) ? text.substr( start ) : text.substr( start, nl - start );
    if ( !line.empty() ) {
      if ( line[0] == ggg::GGG::Okay ) {
        // Canonicalize to OK / OZ (mirrors decodeOutput in ts/cxx/cases.ts):
        // failure is signalled by an F<code> arg before any comment, not by the
        // echoed id.
        bool failed = false;
        for ( const auto &arg : outputArgs( line ) ) {
          if ( !arg.empty() && arg[0] == (char) ggg::GGG::Failure ) { failed = true; break; }
        }
        d.statuses.push_back( failed ? "OZ" : "OK" );
      } else {
        for ( const auto &arg : outputArgs( line ) ) {
          // value slot only (V Value); skip addresses/metadata + the echoed G
          // command, matching decodeOutput() in ts/cxx/cases.ts.
          if ( arg.size() > 1 && arg[0] == ggg::GGG::Value
              && arg[1] != ggg::GGG::Quote
              && arg[1] != ggg::GGG::StringToEOL ) {
            std::string data = arg.substr( 1 );          // drop the leading code char
            size_t b = 0;
            while ( true ) {
              size_t comma = data.find( ',', b );
              std::string piece = ( comma == std::string::npos ) ? data.substr( b ) : data.substr( b, comma - b );
              if ( !piece.empty() ) {
                char *end = nullptr;
                float v = strtof( piece.c_str(), &end );
                if ( end != piece.c_str() ) d.values.push_back( v );
              }
              if ( comma == std::string::npos ) break;
              b = comma + 1;
            }
          }
        }
      }
    }
    if ( nl == std::string::npos ) break;
    start = nl + 1;
  }
  return d;
}

template <class T>
static void runConformance(
  bool requireExactOutput = true,
  bool includeFloatRequired = true,
  int *skippedForFloat = nullptr
) {
  for ( int i = 0; i < ggg_conformance::caseCount; i++ ) {
    const auto &c = ggg_conformance::cases[i];
    if ( c.requiresFloat && !includeFloatRequired ) {
      if ( skippedForFloat ) ( *skippedForFloat )++;
      continue;
    }
    ConformanceMachineT<T> machine;
    machine.setupFor( c.needs );
    machine.run( c.program );
    // Async (T12) cases: the host drives the clock, so replay the same poll
    // times the TS reference used when the golden was generated.
    for ( int k = 0; k < c.pollCount; k++ ) machine.poll( c.polls[k] );
    std::string got = conformanceStrip( machine.out );
    Decoded d = decodeOutput( got );
    // value-tolerance contract
    TEST_ASSERT_EQUAL_INT_MESSAGE( c.valueCount, (int) d.values.size(), c.name );
    for ( int k = 0; k < c.valueCount && k < (int) d.values.size(); k++ ) {
      TEST_ASSERT_FLOAT_WITHIN_MESSAGE( (float) ggg_conformance::EPSILON, (float) c.values[k], d.values[k], c.name );
    }

    // control status: "" => no response; else every response equals status
    if ( c.status[0] == '\0' ) {
      TEST_ASSERT_EQUAL_INT_MESSAGE( 0, (int) d.statuses.size(), c.name );
    } else {
      TEST_ASSERT_TRUE_MESSAGE( d.statuses.size() > 0, c.name );
      for ( const auto &s : d.statuses ) TEST_ASSERT_EQUAL_STRING_MESSAGE( c.status, s.c_str(), c.name );
    }

    // opt-in byte exactness, where formatting itself is the test
    if ( requireExactOutput && c.expected )
      TEST_ASSERT_EQUAL_STRING_MESSAGE( c.expected, got.c_str(), c.name );
  }
}

void test_conformance() {
  runConformance<ggg::FloatTraits>();
}

// The seam itself, checked at compile time. runConformance<DoubleTraits> below
// proves the tree BEHAVES under a substituted NumberType; these prove the
// substitution is real rather than two names for one float machine. Note that
// the corpus alone could not tell the difference: output renders at six
// significant digits, which hides the extra width.
static_assert( sizeof( ggg::MachineT<ggg::FloatTraits>::Number ) == 4, "float traits" );
static_assert( sizeof( ggg::MachineT<ggg::DoubleTraits>::Number ) == 8, "double traits" );
static_assert( sizeof( ggg::MachineT<ggg::FixedTraits>::Number ) == 4, "fixed traits" );
static_assert( !std::is_same<ggg::MachineT<ggg::FloatTraits>,
                             ggg::MachineT<ggg::DoubleTraits>>::value,
               "the two instantiations are distinct types" );
static_assert( !std::is_convertible<double, ggg::FixedTraits::Number>::value,
               "fixed machine numbers cannot silently enter through double" );
static_assert( !std::is_convertible<ggg::FixedTraits::Number, double>::value,
               "fixed machine numbers cannot silently leave through double" );
static_assert( std::is_same<ggg::DefaultTraits, ggg::FixedTraits>::value,
               "Q16.16 fixed point is the default backend" );
// ...and the legacy alias names that fixed default configuration.
static_assert( std::is_same<ggg::Machine, ggg::MachineT<ggg::DefaultTraits>>::value,
               "ggg::Machine is the default instantiation" );

// The whole corpus again on a machine whose NumberType is double. If the
// abstraction leaked -- a float hidden in a signature, a NumberType that should
// have been T::Number -- this either fails to compile or drifts outside the
// value tolerance.
void test_conformance_double() {
  runConformance<ggg::DoubleTraits>();
}

void test_conformance_fixed() {
  // Fixed-point quantization may render a longer decimal spelling than the
  // reference, so this uses the corpus's numeric tolerance + control responses
  // but deliberately skips its opt-in byte-exact formatting assertions and
  // cases explicitly marked as requiring an IEEE floating backend.
  int skippedForFloat = 0;
  runConformance<ggg::FixedTraits>( false, false, &skippedForFloat );
  TEST_ASSERT_EQUAL_INT( 2, skippedForFloat );
}

struct FixedPrintMachine : public ggg::MachineT<ggg::FixedTraits> {
  std::string out;
  void write( const ggg::String &s ) override { out += s; }
  void setup() override {
    this->addCommand( new ggg::PrintNumbersT<ggg::FixedTraits>() );
  }
};

void test_fixed_number_machine() {
  using Fixed = ggg::FixedTraits::Number;
  using Ops = ggg::NumberOps<Fixed>;

  TEST_ASSERT_EQUAL_INT32( 65536, Fixed( 1 ).raw() );
  TEST_ASSERT_EQUAL_INT32( 256, Fixed::fromRatio( 1, 256 ).raw() );
  TEST_ASSERT_EQUAL_INT32( 256, ( Fixed( 1 ) / Fixed( 256 ) ).raw() );
  TEST_ASSERT_EQUAL_INT32( 98304, Fixed::fromRatio( 3, 2 ).raw() );
  TEST_ASSERT_EQUAL_INT32(
    49152,
    ( Fixed::fromRatio( 3, 2 ) * Fixed::fromRatio( 1, 2 ) ).raw()
  );

  char *end = nullptr;
  Fixed parsed = Ops::parse( "-12.375e1x", &end );
  TEST_ASSERT_EQUAL_INT32( -8110080, parsed.raw() );
  TEST_ASSERT_EQUAL_CHAR( 'x', *end );
  TEST_ASSERT_EQUAL_STRING( "-123.75", Ops::format( parsed ).c_str() );

  Fixed unsupported;
  TEST_ASSERT_FALSE( ggg::applyOperator(
    "sinh", Fixed( 1 ), Fixed( 0 ), unsupported
  ) );

  FixedPrintMachine machine;
  machine.setup();
  machine.run( "P10 V1.5,-2.25,1:3\n" );
  TEST_ASSERT_EQUAL_STRING( "V1.5,-2.25,1,2,3\nOK\n", machine.out.c_str() );

  machine.out.clear();
  machine.run( "P10 V0H80\n" );
  TEST_ASSERT_EQUAL_STRING( "V0.5019683837890625\nOK\n", machine.out.c_str() );
}

// Matrix command layer: register table + G20 Write / G10 Read round-trip.
struct MatrixCmdMachine : public ggg::MachineT<ggg::FloatTraits> {
  std::string out;
  void write( const ggg::String &s ) override { out += s; }
};

void test_matrix_commands() {
  MatrixCmdMachine m;
  m.addCommand( new ggg::MatrixWriteT<ggg::FloatTraits>() );
  m.addCommand( new ggg::MatrixReadT<ggg::FloatTraits>() );

  auto mat = new ggg::Matrix<float,true,ggg::FloatTraits>({1,4});  // 1 comp x 4 = size 4, watched
  mat->allocate();
  mat->name = "buf0";
  m.addRegister( mat );

  TEST_ASSERT_EQUAL_PTR( mat, m.getRegister(0) );

  m.run("G20 R0 P0 V10,20,30,40\n");
  TEST_ASSERT_EQUAL_FLOAT( 10, mat->readNumber(0) );
  TEST_ASSERT_EQUAL_FLOAT( 40, mat->readNumber(3) );
  TEST_ASSERT_TRUE( mat->changeIndex > 0 );
  TEST_ASSERT_EQUAL_STRING( "OK\n", m.out.c_str() );

  m.out.clear();
  m.run("G20 R0 P1 V99\n");                 // partial write at offset
  TEST_ASSERT_EQUAL_FLOAT( 99, mat->readNumber(1) );
  TEST_ASSERT_EQUAL_FLOAT( 10, mat->readNumber(0) );

  m.out.clear();
  m.run("G10 R0 P0 S4\n");                   // read -> replayable G20 write
  TEST_ASSERT_NOT_NULL( strstr( m.out.c_str(), "G20 R0 P0 V10,99,30,40" ) );
  TEST_ASSERT_NOT_NULL( strstr( m.out.c_str(), "OK\n" ) );

  m.out.clear();
  m.run("G10 R0 P2 S2\n");                   // sub-range read
  TEST_ASSERT_NOT_NULL( strstr( m.out.c_str(), "G20 R0 P2 V30,40" ) );

  // Address the same register by name (L) instead of index (R).
  m.out.clear();
  m.run("G20 R\"buf0\" P0 V7,8\n");
  TEST_ASSERT_EQUAL_FLOAT( 7, mat->readNumber(0) );
  TEST_ASSERT_EQUAL_FLOAT( 8, mat->readNumber(1) );
  TEST_ASSERT_EQUAL_STRING( "OK\n", m.out.c_str() );

  m.out.clear();
  m.run("G10 R\"buf0\" P0 S2\n");            // read by name -> replayable G20 (by index)
  TEST_ASSERT_NOT_NULL( strstr( m.out.c_str(), "G20 R0 P0 V7,8" ) );

  // R is the universal selector: a string R resolves by name, just like L.
  m.out.clear();
  m.run("G20 R\"buf0\" P0 V3,4\n");
  TEST_ASSERT_EQUAL_FLOAT( 3, mat->readNumber(0) );
  TEST_ASSERT_EQUAL_FLOAT( 4, mat->readNumber(1) );
  TEST_ASSERT_EQUAL_STRING( "OK\n", m.out.c_str() );

  m.out.clear();
  m.run("G10 R\"buf0\" P0 S2\n");            // read by name via R -> replayable G20 (by index)
  TEST_ASSERT_NOT_NULL( strstr( m.out.c_str(), "G20 R0 P0 V3,4" ) );

  // Q write operators: combine the incoming value with the current cell.
  mat->writeScalarFloat( 10, 0 );
  mat->writeScalarFloat( 20, 1 );
  m.run("G20 R0 P0 Q\"add\" V5,5\n");        // add: 10+5, 20+5
  TEST_ASSERT_EQUAL_FLOAT( 15, mat->readNumber(0) );
  TEST_ASSERT_EQUAL_FLOAT( 25, mat->readNumber(1) );
  m.run("G20 R0 P0 Q\"mult\" V2,2\n");       // mult: 15*2, 25*2
  TEST_ASSERT_EQUAL_FLOAT( 30, mat->readNumber(0) );
  TEST_ASSERT_EQUAL_FLOAT( 50, mat->readNumber(1) );
  m.run("G20 R0 P0 Q\"neg\" V0\n");          // unary neg (V0 guard): -30
  TEST_ASSERT_EQUAL_FLOAT( -30, mat->readNumber(0) );

  delete mat;
}

// Self-documentation: D2, D4, and D5 stream their individual sections; D1
// streams all three, including result schemas and live reference domains.
void test_doc_commands() {
  MatrixCmdMachine m;
  m.addCommand( new ggg::MatrixReadT<ggg::FloatTraits>() );
  m.addCommand( new ggg::MatrixBlitT<ggg::FloatTraits>() );
  m.addCommand( new ggg::LanguageDescriptionT<ggg::FloatTraits>() );
  m.addCommand( new ggg::LanguageBasicsT<ggg::FloatTraits>() );
  m.addCommand( new ggg::CommandsListT<ggg::FloatTraits>() );
  m.addCommand( new ggg::EnumsListT<ggg::FloatTraits>() );
  auto *reg = new ggg::Matrix<float,false,ggg::FloatTraits>( {1} );
  reg->allocate();
  reg->name = "r";
  m.addRegister( reg );

  m.run( "D2\n" );
  TEST_ASSERT_NULL( strstr( m.out.c_str(), "\n;" ) );
  TEST_ASSERT_NOT_NULL( strstr( m.out.c_str(),
    "D-20 L\"argument.form\" T\"form\" V\"glyph+data\"" ) );
  TEST_ASSERT_NOT_NULL( strstr( m.out.c_str(),
    "D-20 L\"list.grouping\" T\"constraint\" V\"no-parentheses\"" ) );
  TEST_ASSERT_NOT_NULL( strstr( m.out.c_str(),
    "D-21 T\"valid\" V\"G20 R0 P0,0 Q1 V1,0.5 ; trailing comment\"" ) );
  TEST_ASSERT_NOT_NULL( strstr( m.out.c_str(),
    "D-21 T\"invalid\" V\"G20 R0 P(0,0) V1\"" ) );
  TEST_ASSERT_NOT_NULL( strstr( m.out.c_str(),
    "D-21 T\"invalid\" V\"# comment\"" ) );

  m.out.clear();
  m.run( "D4\n" );
  TEST_ASSERT_NULL( strstr( m.out.c_str(), "\n;" ) );
  TEST_ASSERT_NOT_NULL( strstr( m.out.c_str(),
    "D-41 B\"G40\" U\"R\" T\"reference\" R\"ggggx.register\"" ) );
  TEST_ASSERT_NOT_NULL( strstr( m.out.c_str(),
    "D-41 B\"G40\" U\"T\" T\"enum\" R\"ggggx.transform\"" ) );
  TEST_ASSERT_NOT_NULL( strstr( m.out.c_str(),
    "D-40 B\"G40\" T\"command\"" ) );
  TEST_ASSERT_NOT_NULL( strstr( m.out.c_str(),
    "D-40 B\"D2\" T\"command\"" ) );
  TEST_ASSERT_NOT_NULL( strstr( m.out.c_str(),
    "D-40 B\"D-20\" T\"result\"" ) );
  TEST_ASSERT_NOT_NULL( strstr( m.out.c_str(),
    "D-40 B\"D-21\" T\"result\"" ) );
  TEST_ASSERT_NOT_NULL( strstr( m.out.c_str(),
    "D-40 B\"D-40\" T\"result\"" ) );
  TEST_ASSERT_NOT_NULL( strstr( m.out.c_str(), "D-40 B\"D-40\"" ) );
  TEST_ASSERT_NOT_NULL( strstr( m.out.c_str(), "D-40 B\"D-41\"" ) );
  TEST_ASSERT_NOT_NULL( strstr( m.out.c_str(), "D-40 B\"D-42\"" ) );
  TEST_ASSERT_NOT_NULL( strstr( m.out.c_str(), "D-40 B\"D-50\"" ) );
  TEST_ASSERT_NOT_NULL( strstr( m.out.c_str(), "D-40 B\"D-51\"" ) );
  TEST_ASSERT_NOT_NULL( strstr( m.out.c_str(),
    "D-41 B\"D-42\" U\"W\" T\"string\" A\"Returned command code.\"" ) );
  TEST_ASSERT_NOT_NULL( strstr( m.out.c_str(),
    "D-42 B\"G10\" W\"G20\" A\"Replayable buffer write.\"" ) );
  TEST_ASSERT_NOT_NULL( strstr( m.out.c_str(),
    "D-42 B\"D1\" W\"D-42\" A\"Command-to-command return relation.\"" ) );
  TEST_ASSERT_NULL( strstr( m.out.c_str(), "\nD-50 " ) );

  m.out.clear();
  m.run( "D5\n" );
  TEST_ASSERT_NULL( strstr( m.out.c_str(), "\n;" ) );
  TEST_ASSERT_NOT_NULL( strstr( m.out.c_str(),
    "D-51 R1 V-40 L\"command\"" ) );
  TEST_ASSERT_NOT_NULL( strstr( m.out.c_str(),
    "D-51 R1 V-41 L\"argument\"" ) );
  TEST_ASSERT_NOT_NULL( strstr( m.out.c_str(),
    "D-51 R1 V-42 L\"return\"" ) );
  TEST_ASSERT_NOT_NULL( strstr( m.out.c_str(),
    "D-51 R2 V-50 L\"group\"" ) );
  TEST_ASSERT_NOT_NULL( strstr( m.out.c_str(),
    "D-51 R2 V-51 L\"entry\"" ) );
  TEST_ASSERT_NOT_NULL( strstr( m.out.c_str(),
    "D-51 R7 V-20 L\"rule\"" ) );
  TEST_ASSERT_NOT_NULL( strstr( m.out.c_str(),
    "D-51 R7 V-21 L\"example\"" ) );
  TEST_ASSERT_NOT_NULL( strstr( m.out.c_str(),
    "D-51 R8 V3 L\"control\"" ) );
  TEST_ASSERT_NOT_NULL( strstr( m.out.c_str(),
    "D-51 R9 V1 L\"invalid\"" ) );
  TEST_ASSERT_NOT_NULL( strstr( m.out.c_str(),
    "D-50 R13 L\"ggggx.operator\" S58 T\"enum\"" ) );
  TEST_ASSERT_NOT_NULL( strstr( m.out.c_str(),
    "D-51 R13 V2 L\"add\" A\"Add: current + incoming.\"" ) );
  TEST_ASSERT_NOT_NULL( strstr( m.out.c_str(),
    "D-51 R13 V44 L\"hypot\" A\"Euclidean norm of current and incoming.\"" ) );
  TEST_ASSERT_NOT_NULL( strstr( m.out.c_str(),
    "D-51 R13 V57 L\"atanh\"" ) );
  TEST_ASSERT_NOT_NULL( strstr( m.out.c_str(),
    "D-50 R14 L\"ggggx.transform\" S4 T\"enum\"" ) );
  TEST_ASSERT_NOT_NULL( strstr( m.out.c_str(),
    "D-51 R14 V3 L\"offset\"" ) );
  TEST_ASSERT_NOT_NULL( strstr( m.out.c_str(),
    "D-50 R10 L\"ggggx.register\" S1 T\"reference\"" ) );
  TEST_ASSERT_NOT_NULL( strstr( m.out.c_str(),
    "D-51 R10 V0 L\"r\"" ) );

  m.out.clear();
  m.run( "D1\n" );
  TEST_ASSERT_NOT_NULL( strstr( m.out.c_str(), "D-20 L\"argument.form\"" ) );
  TEST_ASSERT_NOT_NULL( strstr( m.out.c_str(), "D-40 B\"D4\"" ) );
  TEST_ASSERT_NOT_NULL( strstr( m.out.c_str(),
    "D-50 R1 L\"CommandResultRecord\"" ) );
}

// Quoted-string arguments: an L"..." token (a quoted string under a code) must
// reach hookString() with the buffered text, and following args must still
// parse. Guards the parser fix in Machine.h (dataAppend(String) delivering the
// value + quote-mode exit so trailing args parse).
struct StringArgCmd : public ggg::CommandTypeT<ggg::FloatTraits> {
  std::string gotName;
  std::vector<float> vals;
  StringArgCmd() { name = "U20"; }
  void hookCommand() override { gotName.clear(); vals.clear(); }
  void hookString() override { gotName = string; }
  void hookNumber() override { if ( code == 'V' ) vals.push_back( (float) number ); }
};

struct StringArgMachine : public ggg::MachineT<ggg::FloatTraits> {
  std::string out;
  StringArgCmd cmd;
  void write( const ggg::String &s ) override { out += s; }
  void setup() override { addCommand( &cmd ); }
};

void test_string_arg() {
  StringArgMachine m;
  m.setup();

  m.run( "U20 L\"brightness\" V0.8\n" );        // L name first, then value
  TEST_ASSERT_EQUAL_STRING( "brightness", m.cmd.gotName.c_str() );
  TEST_ASSERT_EQUAL_INT( 1, (int) m.cmd.vals.size() );
  TEST_ASSERT_EQUAL_FLOAT( 0.8, m.cmd.vals[0] );

  m.run( "U20 V1,0,0.5 L\"color\"\n" );          // values first, L name last
  TEST_ASSERT_EQUAL_STRING( "color", m.cmd.gotName.c_str() );
  TEST_ASSERT_EQUAL_INT( 3, (int) m.cmd.vals.size() );
  TEST_ASSERT_EQUAL_FLOAT( 0.5, m.cmd.vals[2] );

  m.run( "U20 L\"only\"\n" );                     // name only, no values
  TEST_ASSERT_EQUAL_STRING( "only", m.cmd.gotName.c_str() );
  TEST_ASSERT_EQUAL_INT( 0, (int) m.cmd.vals.size() );
}

// Flow control: procedures via the command gate (T10 define / T0 end / T11 run).
struct FlowMachine : public ggg::MachineT<ggg::FloatTraits> {
  std::string out;
  void write( const ggg::String &s ) override { out += s; }
  void setup() override {
    addCommand( new ggg::PrintNumbersT<ggg::FloatTraits>() );
    addCommand( new ggg::ProcedureInitT<ggg::FloatTraits>() );
    addCommand( new ggg::BlockEndT<ggg::FloatTraits>() );
    addCommand( new ggg::ProcedureRunT<ggg::FloatTraits>() );
    addCommand( new ggg::ConditionalT<ggg::FloatTraits>() );
  }
};

void test_flow_procedures() {
  // Defining a procedure does not execute its body.
  {
    FlowMachine m; m.setup();
    m.run( "T10 L\"p\"\nP10 V42\nT0\n" );
    TEST_ASSERT_EQUAL_STRING( "", m.out.c_str() );
    ggg::TProcedure *p = m.getProcedure( "p", false );
    TEST_ASSERT_NOT_NULL( p );
    TEST_ASSERT_EQUAL_INT( 1, (int) p->lines.size() );
    TEST_ASSERT_EQUAL_STRING( "P10 V42", p->lines[0].c_str() );
  }

  // Running a procedure executes its body in order.
  {
    FlowMachine m; m.setup();
    m.run( "T10 L\"p\"\nP10 V1\nP10 V2\nT0\nT11 R\"p\"\n" );
    TEST_ASSERT_EQUAL_STRING( "V1\nOK\nV2\nOK\n", m.out.c_str() );
  }

  // A procedure that runs ITSELF must terminate at the queue bound. drainPending
  // pops as it goes, so pending.size() stays small and the enqueueLines guard
  // never fires -- without the total-work bound in drainPending this spins
  // forever, which on embedded means until reset. If this regresses the suite
  // HANGS rather than failing, so treat a timeout here as this bug.
  // The exact output is asserted identically in ts-test/gggtxFlow.test.ts: the
  // two engines must spend the budget at the SAME point, which is only true
  // because both count machine-enqueued work and ignore host input.
  {
    FlowMachine m; m.setup();
    m.limits.maxQueue = 10;
    m.run( "T10 L\"boom\"\nP10 V1\nT11 R\"boom\"\nT0\nT11 R\"boom\"\n" );
    TEST_ASSERT_EQUAL_STRING(
      "V1\nOK\nV1\nOK\nV1\nOK\nV1\nOK\nV1\nOK\nOK F2\n", m.out.c_str() );
  }

  // Redefining a procedure overwrites the previous body.
  {
    FlowMachine m; m.setup();
    m.run( "T10 L\"p\"\nP10 V1\nT0\nT10 L\"p\"\nP10 V2\nT0\nT11 R\"p\"\n" );
    TEST_ASSERT_EQUAL_STRING( "V2\nOK\n", m.out.c_str() );
  }

  // Running an unknown procedure reports failure (OK id + F6 = ProcedureNotFound).
  {
    FlowMachine m; m.setup();
    m.run( "T11 R\"nope\"\n" );
    TEST_ASSERT_EQUAL_STRING( "OK F6\n", m.out.c_str() );
  }

  // Nested definition is captured as source; inner defined only when outer runs.
  {
    FlowMachine m; m.setup();
    m.run( "T10 L\"outer\"\nT10 L\"inner\"\nP10 V7\nT0\nT0\n" );
    TEST_ASSERT_NULL( m.getProcedure( "inner", false ) );  // not defined yet
    m.run( "T11 R\"outer\"\n" );                            // defines inner
    TEST_ASSERT_EQUAL_STRING( "", m.out.c_str() );
    TEST_ASSERT_NOT_NULL( m.getProcedure( "inner", false ) );
    m.run( "T11 R\"inner\"\n" );                            // now runs inner
    TEST_ASSERT_EQUAL_STRING( "V7\nOK\n", m.out.c_str() );
  }

  // A procedure can call another procedure (ordering via front-insert).
  {
    FlowMachine m; m.setup();
    m.run( "T10 L\"a\"\nP10 V1\nT0\nT10 L\"b\"\nT11 R\"a\"\nP10 V2\nT0\nT11 R\"b\"\n" );
    TEST_ASSERT_EQUAL_STRING( "V1\nOK\nV2\nOK\n", m.out.c_str() );
  }
}

// References: a bare $name reads the whole register; unknown -> no values.
struct RefMachine : public ggg::MachineT<ggg::FloatTraits> {
  std::string out;
  void write( const ggg::String &s ) override { out += s; }
  void setup() override { addCommand( new ggg::PrintNumbersT<ggg::FloatTraits>() ); }
};

void test_references() {
  RefMachine m; m.setup();
  auto mat = new ggg::Matrix<float,false,ggg::FloatTraits>( {1,3} );   // 1 component x 3 = size 3
  mat->allocate();
  mat->name = "r";
  mat->writeScalarFloat( 10, 0 );
  mat->writeScalarFloat( 20, 1 );
  mat->writeScalarFloat( 30, 2 );
  m.addRegister( mat );

  m.run( "P10 V$r\n" );                       // bare ref -> whole register
  TEST_ASSERT_EQUAL_STRING( "V10,20,30\nOK\n", m.out.c_str() );

  m.out.clear();
  m.run( "P10 V$r W$r\n" );                   // ref mid-line, then another
  TEST_ASSERT_EQUAL_STRING( "V10,20,30 W10,20,30\nOK\n", m.out.c_str() );

  m.out.clear();
  m.run( "P10 V$x\n" );                       // unknown register -> no values
  TEST_ASSERT_EQUAL_STRING( "\nOK\n", m.out.c_str() );

  m.out.clear();
  m.run( "P10 V$r[1]\n" );                     // single subscript -> one scalar
  TEST_ASSERT_EQUAL_STRING( "V20\nOK\n", m.out.c_str() );

  m.out.clear();
  m.run( "P10 V$r[0:2]\n" );                   // range subscript (inclusive)
  TEST_ASSERT_EQUAL_STRING( "V10,20,30\nOK\n", m.out.c_str() );

  m.out.clear();
  m.run( "P10 V$r[0,2]\n" );                   // comma list of indices
  TEST_ASSERT_EQUAL_STRING( "V10,30\nOK\n", m.out.c_str() );

  m.out.clear();
  m.run( "P10 V$r[5]\n" );                     // out-of-range index -> dropped
  TEST_ASSERT_EQUAL_STRING( "\nOK\n", m.out.c_str() );

  m.out.clear();
  m.run( "P10 V$r[1:]\n" );                     // open range -> runs to the register's end
  TEST_ASSERT_EQUAL_STRING( "V20,30\nOK\n", m.out.c_str() );

  m.out.clear();
  m.run( "P10 V$r[1>]\n" );                     // ">" is the exclusive spelling, same values
  TEST_ASSERT_EQUAL_STRING( "V20,30\nOK\n", m.out.c_str() );

  m.out.clear();
  m.run( "P10 V$r[0:]\n" );                     // open from 0 -> the whole register
  TEST_ASSERT_EQUAL_STRING( "V10,20,30\nOK\n", m.out.c_str() );

  m.out.clear();
  m.run( "P10 V$r[0:1|0:1]\n" );                // multi-axis -> flat indices 0,1,1,2
  TEST_ASSERT_EQUAL_STRING( "V10,20,20,30\nOK\n", m.out.c_str() );

  m.out.clear();
  m.run( "P10 V$r[1|1]\n" );                     // lone coords -> flat index 1+1=2 -> $r[2]
  TEST_ASSERT_EQUAL_STRING( "V30\nOK\n", m.out.c_str() );

  delete mat;
}

// Flow control: T9 one-shot conditionals (A=all truthy, O=any truthy).
void test_flow_conditionals() {
  // A1 runs; A0 skips.
  {
    FlowMachine m; m.setup();
    m.run( "T9 A1\nP10 V42\nT0\n" );
    TEST_ASSERT_EQUAL_STRING( "V42\nOK\n", m.out.c_str() );
  }
  {
    FlowMachine m; m.setup();
    m.run( "T9 A0\nP10 V42\nT0\n" );
    TEST_ASSERT_EQUAL_STRING( "", m.out.c_str() );
  }
  // A requires all truthy; Y requires any truthy.
  {
    FlowMachine m; m.setup();
    m.run( "T9 A1,0\nP10 V42\nT0\n" );
    TEST_ASSERT_EQUAL_STRING( "", m.out.c_str() );
  }
  {
    FlowMachine m; m.setup();
    m.run( "T9 Y0,0,1\nP10 V42\nT0\n" );
    TEST_ASSERT_EQUAL_STRING( "V42\nOK\n", m.out.c_str() );
  }
  // A skipped conditional swallows a nested block; execution resumes after.
  {
    FlowMachine m; m.setup();
    m.run( "T9 A0\nT9 A1\nP10 V1\nT0\nT0\nP10 V2\n" );
    TEST_ASSERT_EQUAL_STRING( "V2\nOK\n", m.out.c_str() );
  }
  // A true conditional runs a nested conditional.
  {
    FlowMachine m; m.setup();
    m.run( "T9 A1\nT9 A1\nP10 V1\nT0\nT0\n" );
    TEST_ASSERT_EQUAL_STRING( "V1\nOK\n", m.out.c_str() );
  }
  // A procedure body may contain conditionals.
  {
    FlowMachine m; m.setup();
    m.run( "T10 L\"p\"\nT9 A1\nP10 V1\nT0\nT9 A0\nP10 V2\nT0\nT0\nT11 R\"p\"\n" );
    TEST_ASSERT_EQUAL_STRING( "V1\nOK\n", m.out.c_str() );
  }
}

// Flow control: T9 V per-value iteration with a name/index iteration register.
// The register name is given as a string under code R (R"it"), matching TS.
void test_flow_iteration() {
  // Iterate explicit values, exposing the value as $it.
  {
    FlowMachine m; m.setup();
    m.run( "T9 V10,20,30 R\"it\"\nP10 V$it\nT0\n" );
    TEST_ASSERT_EQUAL_STRING( "V10\nOK\nV20\nOK\nV30\nOK\n", m.out.c_str() );
  }
  // Iterate a range.
  {
    FlowMachine m; m.setup();
    m.run( "T9 V0:3 R\"it\"\nP10 V$it\nT0\n" );
    TEST_ASSERT_EQUAL_STRING( "V0\nOK\nV1\nOK\nV2\nOK\nV3\nOK\n", m.out.c_str() );
  }
  // Iteration register addressable by index (R0 -> read $0).
  {
    FlowMachine m; m.setup();
    m.run( "T9 V7,8 R0\nP10 V$0\nT0\n" );
    TEST_ASSERT_EQUAL_STRING( "V7\nOK\nV8\nOK\n", m.out.c_str() );
  }
  // P selects a scalar offset; an on-demand register grows through that cell.
  {
    FlowMachine m; m.setup();
    m.run( "T9 V7,8 R\"it\" P2\nP10 V$it[0:2]\nT0\n" );
    TEST_ASSERT_EQUAL_STRING( "V0,0,7\nOK\nV0,0,8\nOK\n", m.out.c_str() );
  }
  // Iteration inside a procedure body.
  {
    FlowMachine m; m.setup();
    m.run( "T10 L\"p\"\nT9 V1,2 R\"i\"\nP10 V$i\nT0\nT0\nT11 R\"p\"\n" );
    TEST_ASSERT_EQUAL_STRING( "V1\nOK\nV2\nOK\n", m.out.c_str() );
  }
}

// Sample.h parity: values hand-verified against the TS Sample (ts/ggggx/Sample.ts).
// Note the in-place pos-mutation quirk -- the second descent on an inner axis
// reads the integer-rounded coordinate, so linear-center is 6.25, not 7.0.
void test_sample() {
  // 1-D buffer [10,20,30] (normalized coords; val = pos * size).
  auto *line = new ggg::Matrix<float,false,ggg::FloatTraits>( {3} );
  line->allocate();
  line->write( {10,20,30} );
  TEST_ASSERT_EQUAL_FLOAT( 10, ggg::Sample( line, {0.0}, 0, {"linear"} )[0] );
  TEST_ASSERT_EQUAL_FLOAT( 25, ggg::Sample( line, {0.5}, 0, {"linear"} )[0] );   // lerp px1,px2
  TEST_ASSERT_EQUAL_FLOAT( 20, ggg::Sample( line, {0.5}, 0, {"nearest"} )[0] );
  TEST_ASSERT_EQUAL_FLOAT( 10, ggg::Sample( line, {0.0}, 0, {"nearest"} )[0] );
  // fold filters (Sample args: filter, edges, footprint) over a whole-axis footprint
  std::vector<double> fp3 = { 3 };
  TEST_ASSERT_EQUAL_FLOAT( 30, ggg::Sample( line, {0.5}, 0, {"max"},  {}, fp3 )[0] );
  TEST_ASSERT_EQUAL_FLOAT( 10, ggg::Sample( line, {0.5}, 0, {"min"},  {}, fp3 )[0] );
  TEST_ASSERT_EQUAL_FLOAT( 60, ggg::Sample( line, {0.5}, 0, {"add"},  {}, fp3 )[0] );
  TEST_ASSERT_EQUAL_FLOAT( 20, ggg::Sample( line, {0.5}, 0, {"mean"}, {}, fp3 )[0] );
  // a point filter (linear/nearest) ignores the footprint and samples the centre
  TEST_ASSERT_EQUAL_FLOAT( 20, ggg::Sample( line, {0.5}, 0, {"nearest"}, {}, fp3 )[0] );

  // 3x3 [1..9]: the in-place pos-mutation quirk => linear-center is 6.25, not 7.0.
  auto *src = new ggg::Matrix<float,false,ggg::FloatTraits>( {3,3} );
  src->allocate();
  src->write( {1,2,3,4,5,6,7,8,9} );
  TEST_ASSERT_EQUAL_FLOAT( 5,    ggg::Sample( src, {0.5,0.5}, 0, {"nearest"} )[0] );
  TEST_ASSERT_EQUAL_FLOAT( 6.25, ggg::Sample( src, {0.5,0.5}, 0, {"linear"} )[0] );
  // per-axis filter: linear on X, nearest on Y -> 5.5
  TEST_ASSERT_EQUAL_FLOAT( 5.5,  ggg::Sample( src, {0.5,0.5}, 0, {"linear","nearest"} )[0] );

  // multi-channel: 3ch x 3px (dimension 1); linear half px0->px1 = [0.5,0.5,0].
  auto *rgb = new ggg::Matrix<float,false,ggg::FloatTraits>( {3,3} );
  rgb->allocate();
  rgb->write( {1,0,0, 0,1,0, 0,0,1} );
  auto c = ggg::Sample( rgb, {0, 1.0/6}, 1, {"linear"} );
  TEST_ASSERT_EQUAL_INT( 3, (int) c.size() );
  TEST_ASSERT_EQUAL_FLOAT( 0.5, c[0] );
  TEST_ASSERT_EQUAL_FLOAT( 0.5, c[1] );
  TEST_ASSERT_EQUAL_FLOAT( 0.0, c[2] );
}

// MatrixBlit (G40) end-to-end: drive the command and check the destination.
// Expected dest data mirrors the TS MatrixBlit.test.ts cases.
void test_blit() {
  MatrixCmdMachine m;
  m.addCommand( new ggg::MatrixWriteT<ggg::FloatTraits>() );
  m.addCommand( new ggg::MatrixBlitT<ggg::FloatTraits>() );

  auto *src = new ggg::Matrix<float,false,ggg::FloatTraits>( {3,3} ); src->allocate(); src->name = "src"; m.addRegister( src ); // 0
  auto *dst = new ggg::Matrix<float,false,ggg::FloatTraits>( {3,3} ); dst->allocate(); dst->name = "dst"; m.addRegister( dst ); // 1

  m.run( "G20 R0 V1,2,3,4,5,6,7,8,9\n" );

  auto expect = [&]( const float *e ) {
    for ( int i = 0; i < 9; i++ ) TEST_ASSERT_EQUAL_FLOAT( e[i], dst->readNumber( i ) );
  };
  const float ident[9]     = { 1,2,3,4,5,6,7,8,9 };
  const float subregion[9] = { 2,2,3,5,5,6,8,8,9 };
  const float flipx[9]     = { 3,2,1,6,5,4,9,8,7 };
  const float transpose[9] = { 1,4,7,2,5,8,3,6,9 };
  const float rotcw[9]     = { 7,4,1,8,5,2,9,6,3 };
  const float magnify[9]   = { 1,1,2,1,1,2,4,4,5 };
  const float added[9]     = { 11,12,13,14,15,16,17,18,19 };

  // default (no mode/coeffs) = full-source box = identity copy
  m.run( "G40 R0 W1\n" );
  expect( ident );

  // box sub-region [1,3] x [0,3] stretched, nearest (F1)
  m.run( "G20 R1 V0,0,0,0,0,0,0,0,0\n" );
  m.run( "G40 R0 W1 T\"box\" M1,3,0,3 F1\n" );
  expect( subregion );

  // box flip: a reversed range [2.5,-0.5] mirrors axis 0 left<->right
  m.run( "G20 R1 V0,0,0,0,0,0,0,0,0\n" );
  m.run( "G40 R0 W1 T\"box\" M2.5,-0.5,0,3 F1\n" );
  expect( flipx );

  // map transpose: dest0<-src1, dest1<-src0
  m.run( "G20 R1 V0,0,0,0,0,0,0,0,0\n" );
  m.run( "G40 R0 W1 T\"map\" M1,0,3,0,0,3 F1\n" );
  expect( transpose );

  // map rotate 90 CW: swap axes + reverse the swapped-in range
  m.run( "G20 R1 V0,0,0,0,0,0,0,0,0\n" );
  m.run( "G40 R0 W1 T\"map\" M1,2.5,-0.5,0,0,3 F1\n" );
  expect( rotcw );

  // half-extent box [0,1.5] nearest magnify (F1 = nearest by index)
  m.run( "G20 R1 V0,0,0,0,0,0,0,0,0\n" );
  m.run( "G40 R0 W1 T\"box\" M0,1.5,0,1.5 F1\n" );
  expect( magnify );

  // per-axis filter F0,1: linear on X, nearest on Y
  const float perAxis[9] = { 1, 1.5f, 2, 1, 1.5f, 2, 4, 4.5f, 5 };
  m.run( "G20 R1 V0,0,0,0,0,0,0,0,0\n" );
  m.run( "G40 R0 W1 T\"box\" M0,1.5,0,1.5 F0,1\n" );
  expect( perAxis );

  // names compose (comma-separated quoted strings): F"linear","nearest" == F0,1
  m.run( "G20 R1 V0,0,0,0,0,0,0,0,0\n" );
  m.run( "G40 R0 W1 T\"box\" M0,1.5,0,1.5 F\"linear\",\"nearest\"\n" );
  expect( perAxis );

  // operator add onto a dest pre-filled with 10 (default full-source blit)
  m.run( "G20 R1 V10,10,10,10,10,10,10,10,10\n" );
  m.run( "G40 R0 W1 Q\"add\"\n" );
  expect( added );

  // minify, lerp with NO fold (1.5x box): footprint ignored, centre is just lerped
  m.run( "G20 R1 V0,0,0,0,0,0,0,0,0\n" );
  m.run( "G40 R0 W1 T\"box\" M0,4.5,0,4.5 E1\n" );
  const float minLerp[9] = { 1, 2.5f, 3, 5.5f, 7.25f, 7.5f, 7, 8.5f, 9 };
  expect( minLerp );

  // minify, explicit mean fold (2x box) anti-aliases the footprint
  m.run( "G20 R1 V0,0,0,0,0,0,0,0,0\n" );
  m.run( "G40 R0 W1 T\"box\" M0,6,0,6 F2 E1\n" );
  const float minMean[9] = { 1, 2.75f, 3, 5.5f, 7.25f, 7.5f, 7, 8.75f, 9 };
  expect( minMean );

  // minify: separable per-axis fold F4,2 = max-pool X, mean-pool Y (hold edge E1)
  m.run( "G20 R1 V0,0,0,0,0,0,0,0,0\n" );
  m.run( "G40 R0 W1 T\"box\" M0,6,0,6 F4,2 E1\n" );
  const float pooled[9] = { 1, 3, 3, 5.5f, 7.5f, 7.5f, 7, 9, 9 };
  expect( pooled );

  // missing source register -> failure (OK id + F5 = BufferNotFound)
  m.out.clear();
  m.run( "G40 R5 W1\n" );
  TEST_ASSERT_EQUAL_STRING( "OK F5\n", m.out.c_str() );

  delete src;
  delete dst;
}

// Infinity is not a conformance case -- JSON has no Infinity literal, so
// golden.json cannot carry it and the generated header would emit an undeclared
// identifier. Asserted here (and in ts-test) instead.
void test_unitary_infinity() {
  RefMachine m; m.setup();

  m.run( "P10 V\xE2\x88\x9E\n" );                     // ∞
  TEST_ASSERT_EQUAL_STRING( "VInfinity\nOK\n", m.out.c_str() );

  m.out.clear();
  m.run( "P10 V-\xE2\x88\x9E\n" );                    // -∞
  TEST_ASSERT_EQUAL_STRING( "V-Infinity\nOK\n", m.out.c_str() );

  m.out.clear();
  m.run( "P10 V1e309\n" );                             // overflow renders alike
  TEST_ASSERT_EQUAL_STRING( "VInfinity\nOK\n", m.out.c_str() );

  // A letter where a value was expected is the CODE of the next argument, so V
  // is empty and Q carries the 5. Not a conformance case: the corpus decoder
  // reads values from V args, so it cannot express this output.
  m.out.clear();
  m.run( "P10 VQ5\n" );
  TEST_ASSERT_EQUAL_STRING( "Q5\nOK\n", m.out.c_str() );

  // "inf" is not GGG: V is empty, I takes the unitary n (-1), F is empty.
  m.out.clear();
  m.run( "P10 Vinf\n" );
  TEST_ASSERT_EQUAL_STRING( "I-1\nOK\n", m.out.c_str() );
}

// Run all tests
int main() {
  UNITY_BEGIN();
  RUN_TEST(test_unitary_infinity);
  RUN_TEST(test_norm_compare);
  RUN_TEST(test_matrix_int);
  RUN_TEST(test_matrix_norm);
  RUN_TEST(test_matrix_vec);
  RUN_TEST(test_fixed_presets);
  RUN_TEST(test_fixed_math);
  RUN_TEST(test_matrix_commands);
  RUN_TEST(test_doc_commands);
  RUN_TEST(test_string_arg);
  RUN_TEST(test_references);
  RUN_TEST(test_flow_procedures);
  RUN_TEST(test_flow_conditionals);
  RUN_TEST(test_flow_iteration);
  RUN_TEST(test_sample);
  RUN_TEST(test_blit);
  RUN_TEST(test_conformance);
  RUN_TEST(test_conformance_double);
  RUN_TEST(test_conformance_fixed);
  RUN_TEST(test_fixed_number_machine);
  UNITY_END();
  return 0;
}
