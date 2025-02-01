// cling_script.C
#include "../src/ggg.h"
#include "../src/Print.h"

class TestMachine : public ggg::Machine {
public:
  void setup() override {
    addCommand( new ggg::PrintNumbers() );
    addCommand( new ggg::PrintString() );
  }
};


void testMachine() {
  TestMachine machine;
  machine.setup();
  ggg::Char chr;
  while( (chr = getchar()) != EOF ) {
    machine.input( chr );
  }
}

// .q