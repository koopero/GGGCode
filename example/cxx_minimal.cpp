#include <iostream>
#include "ggg.h"

class ConsoleRuntime final : public ggg::Runtime {
public:
  void write( const ggg::String &text ) override {
    std::cout << text;
  }
};

int main() {
  ConsoleRuntime runtime;
  runtime.run( "P10 V1:3\n" );
  return 0;
}
