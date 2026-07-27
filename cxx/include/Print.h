#pragma once
#include "./Command.h"
#include "./Format.h"

namespace ggg {
  // Mirrors the TS gggpx PrintNumbers hooks (ts/gggpx/PrintCommands.ts) so both
  // implementations emit identical output: the code letter is written once per
  // argument (a space separates arguments), values are comma-separated, and the
  // line is terminated with End + OK. No response-command prefix is emitted.
  template <class T = DefaultTraits>
  class PrintNumbersT : virtual public CommandTypeT<T> {
  public:
    using Base = CommandTypeT<T>;
    using Base::machine; using Base::code; using Base::number;
    using Base::string;  using Base::okay;  using Base::name;
    using Base::description; using Base::args; using Base::addArg;
    using Number = typename T::Number;

    bool needSeperator = false;
    bool wroteCode = false;
    bool firstValue = true;

    PrintNumbersT() {
      name = PrintNumbersName;
    }

    void hookCommand() override {
      needSeperator = false;
      okay = 1;
    }

    void hookCode() override {
      firstValue = true;
      wroteCode = false;
    }

    void hookNumber() override {
      if ( !wroteCode ) {
        if ( needSeperator ) {
          machine->output( GGG::EndArgument );
        }
        machine->output( code );
        wroteCode = true;
        needSeperator = true;
      }

      if ( !firstValue ) {
        machine->output( GGG::Comma );
      }
      machine->output( FormatNumber( number ) );
      firstValue = false;
    }

    void hookFinish() override {
      machine->output( End );
      machine->outputOK();
    }
  };
  using PrintNumbers = PrintNumbersT<>;

  template <class T = DefaultTraits>
  class PrintStringT : virtual public CommandTypeT<T> {
  protected:
    using Base = CommandTypeT<T>;
    using Base::machine; using Base::code; using Base::number;
    using Base::string;  using Base::okay;  using Base::name;
    using Base::description; using Base::args; using Base::addArg;
    using Number = typename T::Number;

    bool didStartLine = false;

  public:
    PrintStringT() {
      name = PrintStringName;
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

      unsigned int codepoint = (unsigned int) number;
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
  using PrintString = PrintStringT<>;
}; // namespace ggg
