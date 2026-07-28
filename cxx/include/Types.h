#pragma once

#include <variant> 
#include <vector>
#include <string>
#include <cstdlib>
#include <unordered_map>
#include "./Config.h"
#include "./ggg/Traits.h"

namespace ggg {
  typedef char Char;
  // The default configuration's number type. Templated code says
  // `typename T::Number`; this is what the non-templated legacy aliases use.
  typedef DefaultTraits::Number NumberType;
  typedef int Index;
  typedef int Int;
  typedef std::string String;
  typedef std::vector<Int> DimType;
};
