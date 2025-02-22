#pragma once
#include "../Types.h"

namespace ggg {
  struct MachineLimits {
    Index maxAxes = 4;
    Index maxBuffer = 1024;
    Index maxOperations = 1024;
    Index maxRegisters = 256;
    Index maxRegisterSize = 0x10000;
  };
}
