// cling_script.C
#include "./gggCode.h"
#include "./Format.h"

class PrintCommand : virtual public gggCommand {
public:
  bool sentCommand = false;
  gggChar sentCode = 0;
  gggChar nextSeperator = 0;

  PrintCommand() {
    name = PrintCommandName;
  }
  void hookBefore() override { }
  void hookCommand() override { 
    sentCommand = false;
    okay = 1;
  }
  void hookCode() override {
    // printf("; hookCode %c\n", code );
  }
  void hookString() override {
    if ( code == Command ) {
      if ( !sentCommand ) {
        machine->output( string );
        sentCommand = true;
        nextSeperator = EndArgument;
      }
      return;
    } 
    
    if ( !sentCommand ) {
      machine->output( PrintResponseName );
      sentCommand = true;
      nextSeperator = EndArgument;
    }
    
    if ( nextSeperator ) {
      machine->output( nextSeperator );
    }

    if ( code != sentCode ) {
      machine->output( code );
      sentCode = code;
    }

    machine->output( FormatString( string ) );
    nextSeperator = Comma;
  }

  void hookNumber() override {
    if ( code == Command ) {
      if ( !sentCommand ) {
        machine->output( PrintPrefix );
        machine->output( FormatNumber( number ) );
        sentCommand = true;
        nextSeperator = EndArgument;
      }
      return;
    } 
    
    if ( !sentCommand ) {
      machine->output( PrintResponseName );
      sentCommand = true;
      nextSeperator = EndArgument;
    }
    
    if ( nextSeperator ) {
      machine->output( nextSeperator );
    }

    if ( code != sentCode ) {
      machine->output( code );
      sentCode = code;
    }

    machine->output( FormatNumber( number ) );
    nextSeperator = Comma;
  }
  void hookFinish() override {
    machine->output( End );
    machine->outputOK( okay );
  }

};

class PrintString : virtual public gggCommand {
protected:
  bool didStartLine = false;

public:
  PrintString() {
    name = PrintCommentCommandName;
  }

  void startLine() {
    if ( !didStartLine ) {
      machine->output( Comment );
      didStartLine = true;
    }
  }

  void hookCommand() override {
    didStartLine = false;
  }
  void hookString() override {
    if ( code != Data ) return;
    startLine();

    machine->output( string );
  }


  void hookNumber() override {
    if ( code != Data ) return;
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
      machine->output( End);
    }
    machine->outputOK();
  }


};

class TestMachine : public gggMachine {
public:
  void setup() override {
    PrintCommand *T10 = new PrintCommand(); 
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