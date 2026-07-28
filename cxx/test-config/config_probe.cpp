#include <string>
#include <type_traits>
#include <utility>
#include "ggg.h"

#ifndef GGG_CONFIG_EXPECT_COMMANDS
#error "GGG_CONFIG_EXPECT_COMMANDS must be defined"
#endif

template <class T, class = void>
struct HasDescription : std::false_type {};
template <class T>
struct HasDescription<T, std::void_t<decltype( std::declval<T>().description )>>
  : std::true_type {};

template <class T, class = void>
struct HasEnumDomains : std::false_type {};
template <class T>
struct HasEnumDomains<T, std::void_t<decltype( std::declval<T>().enumDomains )>>
  : std::true_type {};

template <class T, class = void>
struct HasProcedures : std::false_type {};
template <class T>
struct HasProcedures<T, std::void_t<decltype( std::declval<T>().procedures )>>
  : std::true_type {};

static_assert(
  HasDescription<ggg::CommandTypeT<ggg::FixedTraits>>::value
    == static_cast<bool>( GGGDX_ENABLE ),
  "GGGDX_ENABLE must control command metadata storage"
);
static_assert(
  HasEnumDomains<ggg::MachineT<ggg::FixedTraits>>::value
    == static_cast<bool>( GGGDX_ENABLE ),
  "GGGDX_ENABLE must control the machine enum-domain repository"
);
static_assert(
  HasProcedures<ggg::MachineT<ggg::FixedTraits>>::value
    == static_cast<bool>( GGGTX_ENABLE ),
  "GGGTX_ENABLE must control procedure runtime state"
);

template <class Traits>
class ProbeRuntime : public ggg::RuntimeT<Traits> {
public:
  std::string output;
  void write( const ggg::String &value ) override {
    output += value;
  }
};

template <class Traits>
int commandCount( ProbeRuntime<Traits> &runtime ) {
  int count = 0;
  while ( runtime.commands->getByIndex( count ) ) count++;
  return count;
}

int main() {
  ProbeRuntime<ggg::FixedTraits> fixed;
  if ( commandCount( fixed ) != GGG_CONFIG_EXPECT_COMMANDS ) return 1;

  #if GGGGX_ENABLE
  ggg::FixedQ16_16 fixedOut;
  const bool fixedSin = ggg::applyOperator(
    "sin", ggg::FixedQ16_16( 0 ), ggg::FixedQ16_16( 0 ), fixedOut
  );
  if ( fixedSin != static_cast<bool>( GGGGX_CORDIC_ENABLE ) ) return 2;

  float floatOut = 0;
  const bool floatSin = ggg::applyOperator( "sin", 0.0f, 0.0f, floatOut );
  if ( floatSin != static_cast<bool>( GGGGX_TRIG_ENABLE ) ) return 3;
  #endif

  #if GGGDX_ENABLE
  fixed.run( "D5\n" );
  const bool fixedAdvertisesSin =
    fixed.output.find( "D-51 R13 V22 L\"sin\"" ) != std::string::npos;
  #if GGGGX_ENABLE && GGGGX_TRIG_ENABLE && GGGGX_CORDIC_ENABLE
  if ( !fixedAdvertisesSin ) return 4;
  #else
  if ( fixedAdvertisesSin ) return 5;
  #endif

  ProbeRuntime<ggg::FloatTraits> floating;
  floating.run( "D5\n" );
  const bool floatAdvertisesSin =
    floating.output.find( "D-51 R13 V22 L\"sin\"" ) != std::string::npos;
  #if GGGGX_ENABLE && GGGGX_TRIG_ENABLE
  if ( !floatAdvertisesSin ) return 6;
  #else
  if ( floatAdvertisesSin ) return 7;
  #endif
  #endif

  return 0;
}
