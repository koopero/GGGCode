#pragma once

#include <cstdint>
#include <limits>
#include <type_traits>
#include <cmath>

namespace ggg {

  //
  // An integer plus an implicit scale. `Scale` is the raw representation of
  // one: ScaledNumber<int32_t, 65536, int64_t> is a signed Q16.16-style value,
  // while ScaledNumber<int16_t, 32767, int32_t> is an SNORM16-style value.
  //
  // Arithmetic saturates at Rep's endpoints and widens intermediates through
  // Wide. The default has deliberately NO floating-point constructor or
  // conversion: a fixed-only build should fail to compile at a stray float seam
  // instead of quietly generating floating-point instructions. The final bool
  // enables legacy host/test interoperability for NormalizedNumber.
  //
  template <typename Rep, std::int64_t Scale, typename Wide, bool FloatInterop = false>
  class ScaledNumber {
    static_assert( std::is_integral<Rep>::value, "ScaledNumber Rep must be integral" );
    static_assert( std::is_integral<Wide>::value, "ScaledNumber Wide must be integral" );
    static_assert( Scale > 0, "ScaledNumber Scale must be positive" );
    static_assert( sizeof( Wide ) > sizeof( Rep ), "ScaledNumber Wide must widen Rep" );

  public:
    using RepType = Rep;
    using WideType = Wide;
    static constexpr std::int64_t scale = Scale;
    static constexpr bool floatInterop = FloatInterop;

  private:
    Rep raw_ = 0;

    static constexpr Rep clampRaw( Wide raw ) noexcept {
      return raw > static_cast<Wide>( std::numeric_limits<Rep>::max() )
        ? std::numeric_limits<Rep>::max()
        : raw < static_cast<Wide>( std::numeric_limits<Rep>::lowest() )
          ? std::numeric_limits<Rep>::lowest()
          : static_cast<Rep>( raw );
    }

    static constexpr Wide roundedDivide( Wide numerator, Wide denominator ) noexcept {
      if ( denominator < 0 ) {
        numerator = -numerator;
        denominator = -denominator;
      }
      const Wide half = denominator / 2;
      return numerator < 0
        ? ( numerator - half ) / denominator
        : ( numerator + half ) / denominator;
    }

    template <typename I>
    static constexpr Rep fromInteger( I value ) noexcept {
      // Every integral type used by GGG is no wider than Wide. Comparing before
      // multiplying avoids signed overflow at the saturation boundary.
      const Wide v = static_cast<Wide>( value );
      const Wide hi = static_cast<Wide>( std::numeric_limits<Rep>::max() );
      const Wide lo = static_cast<Wide>( std::numeric_limits<Rep>::lowest() );
      if ( v > hi / static_cast<Wide>( Scale ) ) return std::numeric_limits<Rep>::max();
      if ( v < lo / static_cast<Wide>( Scale ) ) return std::numeric_limits<Rep>::lowest();
      return static_cast<Rep>( v * static_cast<Wide>( Scale ) );
    }

  public:
    constexpr ScaledNumber() noexcept = default;
    constexpr ScaledNumber( const ScaledNumber & ) noexcept = default;
    constexpr ScaledNumber &operator=( const ScaledNumber & ) noexcept = default;

    template <typename I, typename std::enable_if<std::is_integral<I>::value, int>::type = 0>
    constexpr ScaledNumber( I value ) noexcept : raw_( fromInteger( value ) ) {}

    template <typename OtherRep, std::int64_t OtherScale, typename OtherWide, bool OtherFloatInterop>
    constexpr ScaledNumber(
      const ScaledNumber<OtherRep, OtherScale, OtherWide, OtherFloatInterop> &other
    ) noexcept {
      using Common = typename std::common_type<Wide, OtherWide, std::int64_t>::type;
      const Common numerator =
        static_cast<Common>( other.raw() ) * static_cast<Common>( Scale );
      const Common denominator = static_cast<Common>( OtherScale );
      const Common converted = numerator < 0
        ? ( numerator - denominator / 2 ) / denominator
        : ( numerator + denominator / 2 ) / denominator;
      raw_ = clampRaw( static_cast<Wide>( converted ) );
    }

    // Optional bridge for the existing NormalizedNumber API. Fixed machine
    // aliases leave FloatInterop false, so these members do not participate.
    template <typename F,
      typename std::enable_if<FloatInterop && std::is_floating_point<F>::value, int>::type = 0>
    constexpr ScaledNumber( F value ) noexcept {
      const F scaled = std::round( value * static_cast<F>( Scale ) );
      const F hi = static_cast<F>( std::numeric_limits<Rep>::max() );
      const F lo = static_cast<F>( std::numeric_limits<Rep>::lowest() );
      raw_ = scaled > hi ? std::numeric_limits<Rep>::max()
        : scaled < lo ? std::numeric_limits<Rep>::lowest()
        : static_cast<Rep>( scaled );
    }

    static constexpr ScaledNumber fromRaw( Wide raw ) noexcept {
      ScaledNumber result;
      result.raw_ = clampRaw( raw );
      return result;
    }

    static constexpr ScaledNumber fromRatio( Wide numerator, Wide denominator ) noexcept {
      if ( denominator == 0 ) {
        return fromRaw( numerator < 0
          ? static_cast<Wide>( std::numeric_limits<Rep>::lowest() )
          : static_cast<Wide>( std::numeric_limits<Rep>::max() ) );
      }
      return fromRaw( roundedDivide(
        numerator * static_cast<Wide>( Scale ), denominator
      ) );
    }

    constexpr Rep raw() const noexcept { return raw_; }

    template <typename I, typename std::enable_if<std::is_integral<I>::value, int>::type = 0>
    explicit constexpr operator I() const noexcept {
      return static_cast<I>( static_cast<Wide>( raw_ ) / static_cast<Wide>( Scale ) );
    }

    template <bool Enabled = FloatInterop,
      typename std::enable_if<Enabled, int>::type = 0>
    constexpr operator double() const noexcept {
      return static_cast<double>( raw_ ) / static_cast<double>( Scale );
    }

    template <bool Enabled = FloatInterop,
      typename std::enable_if<Enabled, int>::type = 0>
    constexpr operator float() const noexcept {
      return static_cast<float>( raw_ ) / static_cast<float>( Scale );
    }

    constexpr ScaledNumber operator-() const noexcept {
      if ( raw_ == std::numeric_limits<Rep>::lowest() )
        return fromRaw( static_cast<Wide>( std::numeric_limits<Rep>::max() ) );
      return fromRaw( -static_cast<Wide>( raw_ ) );
    }

    constexpr ScaledNumber &operator+=( ScaledNumber other ) noexcept {
      raw_ = clampRaw( static_cast<Wide>( raw_ ) + static_cast<Wide>( other.raw_ ) );
      return *this;
    }

    constexpr ScaledNumber &operator-=( ScaledNumber other ) noexcept {
      raw_ = clampRaw( static_cast<Wide>( raw_ ) - static_cast<Wide>( other.raw_ ) );
      return *this;
    }

    constexpr ScaledNumber &operator*=( ScaledNumber other ) noexcept {
      raw_ = clampRaw(
        roundedDivide(
          static_cast<Wide>( raw_ ) * static_cast<Wide>( other.raw_ ),
          static_cast<Wide>( Scale )
        )
      );
      return *this;
    }

    constexpr ScaledNumber &operator/=( ScaledNumber other ) noexcept {
      if ( other.raw_ == 0 ) {
        raw_ = raw_ < 0 ? std::numeric_limits<Rep>::lowest()
                        : std::numeric_limits<Rep>::max();
      } else {
        raw_ = clampRaw(
          roundedDivide(
            static_cast<Wide>( raw_ ) * static_cast<Wide>( Scale ),
            static_cast<Wide>( other.raw_ )
          )
        );
      }
      return *this;
    }

    friend constexpr ScaledNumber operator+( ScaledNumber left, ScaledNumber right ) noexcept {
      left += right;
      return left;
    }

    friend constexpr ScaledNumber operator-( ScaledNumber left, ScaledNumber right ) noexcept {
      left -= right;
      return left;
    }

    friend constexpr ScaledNumber operator*( ScaledNumber left, ScaledNumber right ) noexcept {
      left *= right;
      return left;
    }

    friend constexpr ScaledNumber operator/( ScaledNumber left, ScaledNumber right ) noexcept {
      left /= right;
      return left;
    }

    friend constexpr bool operator==( ScaledNumber left, ScaledNumber right ) noexcept {
      return left.raw_ == right.raw_;
    }
    friend constexpr bool operator!=( ScaledNumber left, ScaledNumber right ) noexcept {
      return left.raw_ != right.raw_;
    }
    friend constexpr bool operator<( ScaledNumber left, ScaledNumber right ) noexcept {
      return left.raw_ < right.raw_;
    }
    friend constexpr bool operator>( ScaledNumber left, ScaledNumber right ) noexcept {
      return left.raw_ > right.raw_;
    }
    friend constexpr bool operator<=( ScaledNumber left, ScaledNumber right ) noexcept {
      return left.raw_ <= right.raw_;
    }
    friend constexpr bool operator>=( ScaledNumber left, ScaledNumber right ) noexcept {
      return left.raw_ >= right.raw_;
    }

    template <typename F,
      typename std::enable_if<FloatInterop && std::is_floating_point<F>::value, int>::type = 0>
    friend constexpr bool operator==( ScaledNumber left, F right ) noexcept {
      return left == ScaledNumber( right );
    }
    template <typename F,
      typename std::enable_if<FloatInterop && std::is_floating_point<F>::value, int>::type = 0>
    friend constexpr bool operator==( F left, ScaledNumber right ) noexcept {
      return ScaledNumber( left ) == right;
    }
    template <typename F,
      typename std::enable_if<FloatInterop && std::is_floating_point<F>::value, int>::type = 0>
    friend constexpr bool operator!=( ScaledNumber left, F right ) noexcept {
      return !( left == right );
    }
    template <typename F,
      typename std::enable_if<FloatInterop && std::is_floating_point<F>::value, int>::type = 0>
    friend constexpr bool operator!=( F left, ScaledNumber right ) noexcept {
      return !( left == right );
    }
    template <typename F,
      typename std::enable_if<FloatInterop && std::is_floating_point<F>::value, int>::type = 0>
    friend constexpr bool operator<( ScaledNumber left, F right ) noexcept {
      return static_cast<double>( left ) < static_cast<double>( right );
    }
    template <typename F,
      typename std::enable_if<FloatInterop && std::is_floating_point<F>::value, int>::type = 0>
    friend constexpr bool operator<( F left, ScaledNumber right ) noexcept {
      return static_cast<double>( left ) < static_cast<double>( right );
    }
    template <typename F,
      typename std::enable_if<FloatInterop && std::is_floating_point<F>::value, int>::type = 0>
    friend constexpr bool operator>( ScaledNumber left, F right ) noexcept {
      return right < left;
    }
    template <typename F,
      typename std::enable_if<FloatInterop && std::is_floating_point<F>::value, int>::type = 0>
    friend constexpr bool operator>( F left, ScaledNumber right ) noexcept {
      return right < left;
    }
    template <typename F,
      typename std::enable_if<FloatInterop && std::is_floating_point<F>::value, int>::type = 0>
    friend constexpr bool operator<=( ScaledNumber left, F right ) noexcept {
      return !( left > right );
    }
    template <typename F,
      typename std::enable_if<FloatInterop && std::is_floating_point<F>::value, int>::type = 0>
    friend constexpr bool operator<=( F left, ScaledNumber right ) noexcept {
      return !( left > right );
    }
    template <typename F,
      typename std::enable_if<FloatInterop && std::is_floating_point<F>::value, int>::type = 0>
    friend constexpr bool operator>=( ScaledNumber left, F right ) noexcept {
      return !( left < right );
    }
    template <typename F,
      typename std::enable_if<FloatInterop && std::is_floating_point<F>::value, int>::type = 0>
    friend constexpr bool operator>=( F left, ScaledNumber right ) noexcept {
      return !( left < right );
    }

    static constexpr ScaledNumber lowest() noexcept {
      return fromRaw( static_cast<Wide>( std::numeric_limits<Rep>::lowest() ) );
    }
    static constexpr ScaledNumber max() noexcept {
      return fromRaw( static_cast<Wide>( std::numeric_limits<Rep>::max() ) );
    }

    // Compatibility with the original NormalizedNumber spelling.
    static constexpr ScaledNumber Min() noexcept { return lowest(); }
    static constexpr ScaledNumber Max() noexcept { return max(); }
    constexpr Rep getRaw() const noexcept { return raw(); }
    constexpr double getNormalized() const noexcept {
      static_assert( FloatInterop, "getNormalized requires floating-point interoperability" );
      return static_cast<double>( raw_ ) / static_cast<double>( Scale );
    }
    constexpr void setRaw( Rep raw ) noexcept { raw_ = raw; }
    constexpr void setRaw( Wide raw ) noexcept { raw_ = clampRaw( raw ); }
    template <typename F,
      typename std::enable_if<FloatInterop && std::is_floating_point<F>::value, int>::type = 0>
    constexpr void setNormalized( F value ) noexcept {
      *this = ScaledNumber( value );
    }
  };

  // Compare unlike scaled formats without converting either operand through
  // floating point. Same-format comparisons use the non-template friends above.
  template <typename LRep, std::int64_t LScale, typename LWide, bool LF,
            typename RRep, std::int64_t RScale, typename RWide, bool RF>
  constexpr bool operator==(
    ScaledNumber<LRep, LScale, LWide, LF> left,
    ScaledNumber<RRep, RScale, RWide, RF> right
  ) noexcept {
    using Common = typename std::common_type<LWide, RWide, std::int64_t>::type;
    return static_cast<Common>( left.raw() ) * static_cast<Common>( RScale )
      == static_cast<Common>( right.raw() ) * static_cast<Common>( LScale );
  }

  template <typename LRep, std::int64_t LScale, typename LWide, bool LF,
            typename RRep, std::int64_t RScale, typename RWide, bool RF>
  constexpr bool operator!=(
    ScaledNumber<LRep, LScale, LWide, LF> left,
    ScaledNumber<RRep, RScale, RWide, RF> right
  ) noexcept {
    return !( left == right );
  }

  template <typename LRep, std::int64_t LScale, typename LWide, bool LF,
            typename RRep, std::int64_t RScale, typename RWide, bool RF>
  constexpr bool operator<(
    ScaledNumber<LRep, LScale, LWide, LF> left,
    ScaledNumber<RRep, RScale, RWide, RF> right
  ) noexcept {
    using Common = typename std::common_type<LWide, RWide, std::int64_t>::type;
    return static_cast<Common>( left.raw() ) * static_cast<Common>( RScale )
      < static_cast<Common>( right.raw() ) * static_cast<Common>( LScale );
  }

  template <typename LRep, std::int64_t LScale, typename LWide, bool LF,
            typename RRep, std::int64_t RScale, typename RWide, bool RF>
  constexpr bool operator>(
    ScaledNumber<LRep, LScale, LWide, LF> left,
    ScaledNumber<RRep, RScale, RWide, RF> right
  ) noexcept {
    return right < left;
  }

  template <typename LRep, std::int64_t LScale, typename LWide, bool LF,
            typename RRep, std::int64_t RScale, typename RWide, bool RF>
  constexpr bool operator<=(
    ScaledNumber<LRep, LScale, LWide, LF> left,
    ScaledNumber<RRep, RScale, RWide, RF> right
  ) noexcept {
    return !( right < left );
  }

  template <typename LRep, std::int64_t LScale, typename LWide, bool LF,
            typename RRep, std::int64_t RScale, typename RWide, bool RF>
  constexpr bool operator>=(
    ScaledNumber<LRep, LScale, LWide, LF> left,
    ScaledNumber<RRep, RScale, RWide, RF> right
  ) noexcept {
    return !( left < right );
  }

  using FixedQ16_16 = ScaledNumber<std::int32_t, 65536, std::int64_t>;
  using FixedCoordinate = ScaledNumber<std::int32_t, 1048576, std::int64_t>;

} // namespace ggg
