#pragma once

#include <cstdint>
#include <type_traits>
#include <cmath>
#include <algorithm>
#include <iostream>

template <typename StorageType, StorageType MaxValue>
class NormalizedNumber
{
	static_assert(std::is_integral_v<StorageType>, "IntegerType must be an integral type.");
	static_assert(MaxValue > 0, "MaxValue must be greater than 0.");

public:
	using InternalType = StorageType;
	using WorkingType = int32_t;

	static constexpr double ScaleToNormalized = 1.0 / MaxValue;
	static constexpr WorkingType ScaleFromNormalized = MaxValue;

private:
	friend class NormalizedNumber;

	InternalType value;

	static constexpr WorkingType NormalMin = std::numeric_limits<InternalType>::min() > -std::numeric_limits<InternalType>::max() ? std::numeric_limits<InternalType>::min() : -std::numeric_limits<InternalType>::max();
	static constexpr WorkingType NormalMax = std::numeric_limits<InternalType>::max();

public:
	// Constructors
	constexpr NormalizedNumber() : value(0) {}
	constexpr explicit NormalizedNumber( double normalizedValue ) {
		setNormalized(normalizedValue);
	}
  constexpr NormalizedNumber( float normalizedValue ) {
		setNormalized(normalizedValue);
	}

	constexpr explicit NormalizedNumber(WorkingType rawValue) {
		setNormalized(rawValue);
	}

	template <typename OtherStorageType, OtherStorageType OtherMaxValue>
	constexpr NormalizedNumber(const NormalizedNumber<OtherStorageType, OtherMaxValue>& other) {
		WorkingType val = other.getRaw() * ScaleFromNormalized;
		val /= OtherMaxValue;
		setRaw(val);
	}

	// Accessors
	constexpr double getNormalized() const noexcept {
		return value * ScaleToNormalized;
	}

	constexpr InternalType getRaw() const noexcept {
		return value;
	}

	// Mutators
	constexpr void setNormalized(double normalizedValue) noexcept {
		WorkingType val = std::round(normalizedValue * ScaleFromNormalized);
		setRaw(val);
	}

	constexpr void setRaw(InternalType rawValue) noexcept {
		value = rawValue;
	}

	constexpr void setRaw(WorkingType rawValue) noexcept {
		rawValue = rawValue > NormalMax ? NormalMax : rawValue;
		rawValue = rawValue < NormalMin ? NormalMin : rawValue;
		value = static_cast<InternalType>(rawValue);
	}

	constexpr NormalizedNumber& operator=( const float & num ) noexcept {
		setNormalized(num);
		return *this;
	}

	constexpr NormalizedNumber& operator=( const NormalizedNumber & num ) noexcept {
		setRaw( num.getRaw() );
		return *this;
	}

	template <typename OtherStorageType, OtherStorageType OtherMaxValue>
	constexpr NormalizedNumber& operator=( const NormalizedNumber<OtherStorageType, OtherMaxValue> & num ) noexcept {
		WorkingType val = num.getRaw() * ScaleFromNormalized;
		val /= OtherMaxValue;
		setRaw(val);
		return *this;
	}

	// Arithmetic Operators
	constexpr NormalizedNumber& operator+=(const NormalizedNumber& other) noexcept {
		value = (value + other.value > MaxValue) ? MaxValue : value + other.value;
		return *this;
	}

	template <typename OtherStorageType, OtherStorageType OtherMaxValue>
	constexpr NormalizedNumber& operator+=(const NormalizedNumber<OtherStorageType, OtherMaxValue>& other) noexcept {
		WorkingType val = getRaw() * other.ScaleFromNormalized + other.getRaw() * ScaleFromNormalized;
		val /= other.ScaleFromNormalized;
		setRaw(val);
		return *this;
	}

	constexpr NormalizedNumber& operator+=(double scalar) noexcept {
		WorkingType val = getRaw() + scalar * ScaleFromNormalized;
		setRaw(val);
		return *this;
	}


	constexpr NormalizedNumber& operator-=(const NormalizedNumber& other) noexcept {
    WorkingType val = value - other.value;
    setRaw(val);
		return *this;
	}

	template <typename OtherStorageType, OtherStorageType OtherMaxValue>
	constexpr NormalizedNumber& operator-=(const NormalizedNumber<OtherStorageType, OtherMaxValue>& other) noexcept {
		WorkingType val = getRaw() * other.ScaleFromNormalized - other.getRaw() * ScaleFromNormalized;
		val /= other.ScaleFromNormalized;
		setRaw(val);
		return *this;
	}

	constexpr NormalizedNumber& operator-=(double scalar) noexcept {
		WorkingType val = getRaw() - scalar * ScaleFromNormalized;
		setRaw(val);
		return *this;
	}

	constexpr NormalizedNumber& operator*=(double scalar) noexcept {
		setNormalized(getNormalized() * scalar);
		return *this;
	}

	constexpr NormalizedNumber& operator/=(double scalar) noexcept {
		// Handle
		std::cout << "Divide by " << scalar << std::endl;
		setNormalized(getNormalized() / scalar);
		return *this;
	}

	constexpr operator double() const noexcept {
		return getNormalized();
	}
	constexpr operator float() const noexcept {
		return static_cast<float>(getNormalized());
	}

	// Binary Operators
	constexpr friend NormalizedNumber operator+(NormalizedNumber left, const NormalizedNumber& right) noexcept {
		left += right;
		return left;
	}

	template <typename RightStorageType, RightStorageType RightMaxValue>
	constexpr friend NormalizedNumber operator+(NormalizedNumber left, const NormalizedNumber<RightStorageType,RightMaxValue>& right) noexcept {
		WorkingType val = (left.getRaw() * right.ScaleFromNormalized ) + right.getRaw() * left.ScaleFromNormalized;
		val /= right.ScaleFromNormalized;
		left.setRaw(val);
		return left;
	}


	constexpr friend NormalizedNumber operator-(NormalizedNumber left, const NormalizedNumber& right) noexcept {
		left -= right;
		return left;
	}

	constexpr friend NormalizedNumber operator*(NormalizedNumber number, double scalar) noexcept {
		number *= scalar;
		return number;
	}

	constexpr friend NormalizedNumber operator/(NormalizedNumber number, double scalar) noexcept {
		number /= scalar;
		return number;
	}

	// Comparison Operators
	constexpr friend bool operator==(const NormalizedNumber& left, const NormalizedNumber& right) noexcept {
		return left.value == right.value;
	}

  template <typename OtherStorageType, OtherStorageType OtherMaxValue>
  constexpr friend bool operator==(const NormalizedNumber& left, const NormalizedNumber<OtherStorageType, OtherMaxValue>& right) noexcept {
    WorkingType val = left.getRaw() * right.ScaleFromNormalized;
    val /= OtherMaxValue;
    return val == right.getRaw();
  }

  constexpr friend bool operator==(const NormalizedNumber& left, double right) noexcept {
    WorkingType val = std::round(right * ScaleFromNormalized);
    return left.getRaw() == val;
  }

	constexpr friend bool operator!=(const NormalizedNumber& left, const NormalizedNumber& right) noexcept {
		return !(left == right);
	}

	constexpr friend bool operator<(const NormalizedNumber& left, const NormalizedNumber& right) noexcept {
		return left.value < right.value;
	}

	constexpr friend bool operator>(const NormalizedNumber& left, const NormalizedNumber& right) noexcept {
		return left.value > right.value;
	}

	constexpr friend bool operator<=(const NormalizedNumber& left, const NormalizedNumber& right) noexcept {
		return left.value <= right.value;
	}

	constexpr friend bool operator>=(const NormalizedNumber& left, const NormalizedNumber& right) noexcept {
		return left.value >= right.value;
	}

	// Constants
	static constexpr NormalizedNumber Min() noexcept { return NormalizedNumber(0); }
	static constexpr NormalizedNumber Max() noexcept { return NormalizedNumber(MaxValue); }
};
