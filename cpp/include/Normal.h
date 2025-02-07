#pragma once

#include <cstdint>
#include <type_traits>
#include <cmath>
#include <algorithm>
#include <iostream>

template <typename StorageType, StorageType OneValue, typename WorkingType>
class NormalizedNumber {
public:
	using InternalType = StorageType;
	using WorkType = WorkingType;

	static constexpr double ScaleToNormalized = 1.0 / OneValue;
	static constexpr WorkType ScaleFromNormalized = OneValue;

private:
	friend class NormalizedNumber;

	InternalType value;

	static constexpr WorkType NormalMin = std::numeric_limits<InternalType>::min() > -std::numeric_limits<InternalType>::max() ? std::numeric_limits<InternalType>::min() : -std::numeric_limits<InternalType>::max();
	static constexpr WorkType NormalMax = std::numeric_limits<InternalType>::max();

public:
	// Constructors
	constexpr NormalizedNumber() : value(0) {}
	constexpr explicit NormalizedNumber( double normalizedValue ) {
		setNormalized(normalizedValue);
	}
  constexpr NormalizedNumber( float normalizedValue ) {
		setNormalized(normalizedValue);
	}

	constexpr explicit NormalizedNumber(WorkType rawValue) {
		setNormalized(rawValue);
	}

	template <typename OtherStorageType, OtherStorageType OtherOneValue, typename OtherWorkType>
	constexpr NormalizedNumber(const NormalizedNumber<OtherStorageType, OtherOneValue, OtherWorkType>& other) {
		using CommonType = std::common_type_t<WorkType, OtherWorkType>;
		CommonType val = other.getRaw() * ScaleFromNormalized;
		val /= OtherOneValue;
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
		WorkType val = std::round(normalizedValue * ScaleFromNormalized);
		setRaw(val);
	}

	constexpr void setRaw(InternalType rawValue) noexcept {
		value = rawValue;
	}

	constexpr void setRaw(WorkType rawValue) noexcept {
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

	template <typename OtherStorageType, OtherStorageType OtherOneValue, typename OtherWorkType>
	constexpr NormalizedNumber& operator=( const NormalizedNumber<OtherStorageType, OtherOneValue, OtherWorkType> & num ) noexcept {
		using CommonType = std::common_type_t<WorkType, OtherWorkType>;
		CommonType val = num.getRaw() * ScaleFromNormalized;
		val /= OtherOneValue;
		setRaw(val);
		return *this;
	}

	// Arithmetic Operators
	constexpr NormalizedNumber& operator+=(const NormalizedNumber& other) noexcept {
		value = (value + other.value > OneValue) ? OneValue : value + other.value;
		return *this;
	}

	template <typename OtherStorageType, OtherStorageType OtherOneValue, typename OtherWorkType>
	constexpr NormalizedNumber& operator+=(const NormalizedNumber<OtherStorageType, OtherOneValue, OtherWorkType>& other) noexcept {
		using CommonType = std::common_type_t<WorkType, OtherWorkType>;
		CommonType val = getRaw() * other.ScaleFromNormalized + other.getRaw() * ScaleFromNormalized;
		val /= other.ScaleFromNormalized;
		setRaw(val);
		return *this;
	}

	constexpr NormalizedNumber& operator+=(double scalar) noexcept {
		WorkType val = getRaw() + scalar * ScaleFromNormalized;
		setRaw(val);
		return *this;
	}


	constexpr NormalizedNumber& operator-=(const NormalizedNumber& other) noexcept {
    WorkType val = value - other.value;
    setRaw(val);
		return *this;
	}

	template <typename OtherStorageType, OtherStorageType OtherOneValue, typename OtherWorkType>
	constexpr NormalizedNumber& operator-=(const NormalizedNumber<OtherStorageType, OtherOneValue, OtherWorkType>& other) noexcept {
		using CommonType = std::common_type_t<WorkType, OtherWorkType>;
		CommonType val = getRaw() * other.ScaleFromNormalized - other.getRaw() * ScaleFromNormalized;
		val /= other.ScaleFromNormalized;
		setRaw(val);
		return *this;
	}

	constexpr NormalizedNumber& operator-=(double scalar) noexcept {
		WorkType val = getRaw() - scalar * ScaleFromNormalized;
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

	template <typename RightStorageType, RightStorageType RightOneValue, typename RightWorkType>
	constexpr friend NormalizedNumber operator+(NormalizedNumber left, const NormalizedNumber<RightStorageType,RightOneValue,RightWorkType>& right) noexcept {
		WorkType val = (left.getRaw() * right.ScaleFromNormalized ) + right.getRaw() * left.ScaleFromNormalized;
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
	// operator==
	constexpr friend bool operator==(const NormalizedNumber& left, const NormalizedNumber& right) noexcept {
		return left.getRaw() == right.getRaw();
	}
  constexpr friend bool operator==(const NormalizedNumber& left, const double& right) noexcept {
    WorkType val = std::round(right * ScaleFromNormalized);
    return left.getRaw() == val;
  }
  constexpr friend bool operator==(const NormalizedNumber& left, const float& right) noexcept {
    WorkType val = std::round(right * ScaleFromNormalized);
    return left.getRaw() == val;
  }
  constexpr friend bool operator==(const double& left, const NormalizedNumber& right) noexcept {
    WorkType val = std::round(left * ScaleFromNormalized);
    return right.getRaw() == val;
  }
	constexpr friend bool operator==(const float& left, const NormalizedNumber& right) noexcept {
    WorkType val = std::round(left * ScaleFromNormalized);
    return right.getRaw() == val;
  }
  template <typename OtherStorageType, OtherStorageType OtherOneValue, typename OtherWorkType>
  constexpr friend bool operator==(const NormalizedNumber& left, const NormalizedNumber<OtherStorageType, OtherOneValue, OtherWorkType>& right) noexcept {
    WorkType val = left.getRaw() * right.ScaleFromNormalized;
    val /= OneValue;
    return val == right.getRaw();
  }

	// operator!=
	constexpr friend bool operator!=(const NormalizedNumber& left, const NormalizedNumber& right) noexcept {
		return left.getRaw() != right.getRaw();
	}
  constexpr friend bool operator!=(const NormalizedNumber& left, const double& right) noexcept {
    WorkType val = std::round(right * ScaleFromNormalized);
    return left.getRaw() != val;
  }
  constexpr friend bool operator!=(const NormalizedNumber& left, const float& right) noexcept {
    WorkType val = std::round(right * ScaleFromNormalized);
    return left.getRaw() != val;
  }
  constexpr friend bool operator!=(const double& left, const NormalizedNumber& right) noexcept {
    WorkType val = std::round(left * ScaleFromNormalized);
    return right.getRaw() != val;
  }
	constexpr friend bool operator!=(const float& left, const NormalizedNumber& right) noexcept {
    WorkType val = std::round(left * ScaleFromNormalized);
    return right.getRaw() != val;
  }
  template <typename OtherStorageType, OtherStorageType OtherOneValue, typename OtherWorkType>
  constexpr friend bool operator!=(const NormalizedNumber& left, const NormalizedNumber<OtherStorageType, OtherOneValue, OtherWorkType>& right) noexcept {
    WorkType val = left.getRaw() * right.ScaleFromNormalized;
    val /= OneValue;
    return val != right.getRaw();
  }

	// operator<
	constexpr friend bool operator<(const NormalizedNumber& left, const NormalizedNumber& right) noexcept {
		return left.getRaw() < right.getRaw();
	}
	constexpr friend bool operator<(const NormalizedNumber& left, const double& right) noexcept {
		return left.getNormalized() < right;
	}
	constexpr friend bool operator<(const NormalizedNumber& left, const float& right) noexcept {
		return left.getNormalized() < right;
	}
	constexpr friend bool operator<(const double& left, const NormalizedNumber& right) noexcept {
		return left < right.getNormalized();
	}
	constexpr friend bool operator<(const float& left, const NormalizedNumber& right) noexcept {
		return left < right.getNormalized();
	}
  template <typename OtherStorageType, OtherStorageType OtherOneValue, typename OtherWorkType>
	constexpr friend bool operator<(const NormalizedNumber& left, const NormalizedNumber<OtherStorageType, OtherOneValue, OtherWorkType>& right) noexcept {
		return left.getRaw() * OtherOneValue < right.getRaw() * OneValue;
	}


	// operator>
	constexpr friend bool operator>(const NormalizedNumber& left, const NormalizedNumber& right) noexcept {
		return left.getRaw() > right.getRaw();
	}
	constexpr friend bool operator>(const NormalizedNumber& left, const double& right) noexcept {
		return left.getNormalized() > right;
	}
	constexpr friend bool operator>(const NormalizedNumber& left, const float& right) noexcept {
		return left.getNormalized() > right;
	}
	constexpr friend bool operator>(const double& left, const NormalizedNumber& right) noexcept {
		return left > right.getNormalized();
	}
	constexpr friend bool operator>(const float& left, const NormalizedNumber& right) noexcept {
		return left > right.getNormalized();
	}
  template <typename OtherStorageType, OtherStorageType OtherOneValue, typename OtherWorkType>
	constexpr friend bool operator>(const NormalizedNumber& left, const NormalizedNumber<OtherStorageType, OtherOneValue, OtherWorkType>& right) noexcept {
		return left.getRaw() * OtherOneValue > right.getRaw() * OneValue;
	}

	// operator>=
	constexpr friend bool operator>=(const NormalizedNumber& left, const NormalizedNumber& right) noexcept {
		return left.getRaw() >= right.getRaw();
	}
	constexpr friend bool operator>=(const NormalizedNumber& left, const double& right) noexcept {
		return left.getNormalized() >= right;
	}
	constexpr friend bool operator>=(const NormalizedNumber& left, const float& right) noexcept {
		return left.getNormalized() >= right;
	}
	constexpr friend bool operator>=(const double& left, const NormalizedNumber& right) noexcept {
		return left >= right.getNormalized();
	}
	constexpr friend bool operator>=(const float& left, const NormalizedNumber& right) noexcept {
		return left >= right.getNormalized();
	}
  template <typename OtherStorageType, OtherStorageType OtherOneValue, typename OtherWorkType>
	constexpr friend bool operator>=(const NormalizedNumber& left, const NormalizedNumber<OtherStorageType, OtherOneValue, OtherWorkType>& right) noexcept {
		return left.getRaw() * OtherOneValue >= right.getRaw() * OneValue;
	}

	// operator<=
	constexpr friend bool operator<=(const NormalizedNumber& left, const NormalizedNumber& right) noexcept {
		return left.getRaw() <= right.getRaw();
	}
	constexpr friend bool operator<=(const NormalizedNumber& left, const double& right) noexcept {
		return left.getNormalized() <= right;
	}
	constexpr friend bool operator<=(const NormalizedNumber& left, const float& right) noexcept {
		return left.getNormalized() <= right;
	}
	constexpr friend bool operator<=(const double& left, const NormalizedNumber& right) noexcept {
		return left <= right.getNormalized();
	}
	constexpr friend bool operator<=(const float& left, const NormalizedNumber& right) noexcept {
		return left <= right.getNormalized();
	}
  template <typename OtherStorageType, OtherStorageType OtherOneValue, typename OtherWorkType>
	constexpr friend bool operator<=(const NormalizedNumber& left, const NormalizedNumber<OtherStorageType, OtherOneValue, OtherWorkType>& right) noexcept {
		return left.getRaw() * OtherOneValue <= right.getRaw() * OneValue;
	}

	// Constants
	static constexpr NormalizedNumber Min() noexcept { return NormalizedNumber(0); }
	static constexpr NormalizedNumber Max() noexcept { return NormalizedNumber(OneValue); }
};
