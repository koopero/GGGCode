// cling_script.C
#include "./gggCode.h"

class TestCommandState : virtual public gggCommandState {

};

class TestCommand : virtual public gggCommand {
public:
  TestCommand() {
    name = "T10";
  }
  void hookBefore() override { }
  void hookCommand() override { 
    printf("\n  T-1; hookCommand %s\n", name.c_str() );
    okay = 1;
  }
  void hookCode() override {
    printf("; hookCode (%c)\n", code );
  }
  void hookString() override {
    printf("; hookPrimitive %s\n", string.c_str() );
  }
  void hookNumber() override {
    hookNumberOkay();
    printf("; hookNumber %f\n", number );
  }
  void hookFinish() override {
    printf("; hookFinish\n");
    machine->outputOK( okay );
  }

};

class PrintString : virtual public gggCommand {
protected:
  bool didStartLine = false;

public:
  PrintString() {
    name = "P11";
  }

  void startLine() {
    if ( !didStartLine ) {
      machine->output("; ");
      didStartLine = true;
    }
  }

  void hookCommand() override {
    didStartLine = false;
  }
  void hookString() override {
    if ( code != 'V' ) return;
    startLine();

    machine->output( string );
  }


  void hookNumber() override {
    if ( code != 'V' ) return;
    startLine();

    unsigned int codepoint = number;
    if (codepoint <= 0x7F) {
        // Single byte (ASCII)
        machine->output(static_cast<uint8_t>(codepoint));
    } else if (codepoint <= 0x07FF) {
        // Two bytes
        machine->output(static_cast<uint8_t>(0xC0 | ((codepoint >> 6) & 0x1F)));
        machine->output(static_cast<uint8_t>(0x80 | (codepoint & 0x3F)));
    } else if (codepoint <= 0xFFFF) {
        // Three bytes
        machine->output(static_cast<uint8_t>(0xE0 | ((codepoint >> 12) & 0x0F)));
        machine->output(static_cast<uint8_t>(0x80 | ((codepoint >> 6) & 0x3F)));
        machine->output(static_cast<uint8_t>(0x80 | (codepoint & 0x3F)));
    } else if (codepoint <= 0x10FFFF) {
        // Four bytes
        machine->output(static_cast<uint8_t>(0xF0 | ((codepoint >> 18) & 0x07)));
        machine->output(static_cast<uint8_t>(0x80 | ((codepoint >> 12) & 0x3F)));
        machine->output(static_cast<uint8_t>(0x80 | ((codepoint >> 6) & 0x3F)));
        machine->output(static_cast<uint8_t>(0x80 | (codepoint & 0x3F)));
    }
  }

  void hookFinish() override {
    if ( didStartLine ) {
      machine->output('\n');
    }
    machine->outputOK();
  }


};

class TestMachine : public gggMachine {
public:
  void setup() override {
    TestCommand *T10 = new TestCommand(); 
    addCommand( T10 );
    PrintString *P1 = new PrintString();
    addCommand( P1 );
  }
};


void testMachine() {
  TestMachine machine;
  machine.setup();
  gggChar chr;
  while( (chr = getchar()) != EOF ) {
    machine.input( chr );
  }
}

// .q