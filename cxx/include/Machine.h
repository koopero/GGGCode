#pragma once

#include "./Types.h"
#include "./List.h"
#include "./Command.h"
#include "./Compound.h"
#include "./ggg/Limits.h"

namespace ggg {
  struct MachineState {
    GGG lineMode = GGG::Command;
    GGG expressionMode = GGG::Code;
    GGG dataMode;

    enum {
      Start,
      End,
      Step,
    } listMode;

    bool skipData = false;
    bool skipLine = false;

    Index index = 0;
    Index col = 0;
    Index row = 0;

    Char code;
    NumberType value;
    String string;
    String line;
    String comment;
    String argBuffer;

    std::vector<NumberType> numbers;
    std::vector<Char> symbols;

    Index compoundIndex = 0;
    std::vector<CompoundAxis> compoundAxes;

    unsigned long hexAccum;
    Index hexDigit;
    Index hexDigitCount;
    bool hexNormalize;

    uint32_t utf8Accum = 0;
    int utf8Remaining = 0;
  };


  class Machine {
  public:
    MachineLimits limits;
    MachineState state;
    CommandType *command = nullptr;
    // List<MachineRegister> *registers = new List<MachineRegister>();
    List<CommandType> *commands = new List<CommandType>();

    Machine() {
      resetLine();
    }

    virtual void setup() {}

    void resetLine() {
      state.col = 0;
      state.row++;
      state.code = '\0';
      state.hexAccum = 0;
      state.utf8Accum = 0;
      state.utf8Remaining = 0;
      command = nullptr;
      state.lineMode = GGG::Command;
      state.expressionMode = GGG::Code;
      state.argBuffer.clear();

      state.compoundAxes.resize( limits.maxAxes );
    }

    void run( String _code ) {
      for ( Char _char : _code ) {
        parse( _char );
      }
    }

    void input( String _code ) {
      run( _code );
    }

    void input( Char _char ) {
      parse( _char );
    }

    void parse( Char _char ) {
      if ( _char == End ) {
        finishLine();
        return;
      }

      if ( state.expressionMode == GGG::Data && state.dataMode == GGG::StringToEOL ) {
        // StringToEOL
        state.argBuffer += _char;
        return;
      }

      if ( state.lineMode == GGG::Skip ) {
        // Skip
        return;
      }

      if ( _char == GGG::Comment ) {
        // Command Break / Comment ";"
        finishCommand();
        state.lineMode = GGG::Skip;
        return;
      }

      if ( state.lineMode == GGG::Comment ) {
        // Comment
        state.comment += _char;
        return;
      }


      if ( state.lineMode == GGG::Command || state.lineMode == GGG::Argument ) {
        // UTF-8 decoding outside quoted strings
        uint8_t byte = (uint8_t)_char;
        bool inQuotedContext = ( state.dataMode == GGG::Quote || state.dataMode == GGG::Escape );
        if ( !inQuotedContext && byte >= 0x80 ) {
          if ( state.utf8Remaining > 0 ) {
            if ( (byte & 0xC0) == 0x80 ) {
              state.utf8Accum = ( state.utf8Accum << 6 ) | ( byte & 0x3F );
              state.utf8Remaining--;
              if ( state.utf8Remaining == 0 ) {
                finishCompound();
                state.expressionMode = GGG::Encoding;
                dataAppend( (NumberType)state.utf8Accum );
              }
            } else {
              state.utf8Remaining = 0;
            }
          } else if ( byte >= 0xC0 ) {
            if ( state.dataMode == GGG::Number ) {
              finishNumber();
              state.expressionMode = GGG::Encoding;
            }
            if ( byte >= 0xF0 ) {
              state.utf8Accum = byte & 0x07;
              state.utf8Remaining = 3;
            } else if ( byte >= 0xE0 ) {
              state.utf8Accum = byte & 0x0F;
              state.utf8Remaining = 2;
            } else {
              state.utf8Accum = byte & 0x1F;
              state.utf8Remaining = 1;
            }
          }
          return;
        }

        // Actual expression
        switch( state.expressionMode ) {
          case GGG::Code:
            parseCode( _char );
            break;

          case GGG::Encoding:
            parseEncoding( _char );
            break;

          case GGG::Register:
            // parseRegister( _char );
            break;

          case GGG::Data:
            parseData( _char );
            break;
    
          default:
            break;
        }
      }
    }

    void parseCode( Char _char ) {
      if (  _char == ';' ) {
        skipToEndOfLine();
        return;
      }

      if (( _char >= 'a' && _char <= 'z' ) || ( _char >= 'A' && _char <= 'Z' )) {
        _char = std::toupper(_char);
        state.code = _char;
        if ( state.lineMode == GGG::Argument && command ) {
          command->code = _char;
          command->hookCode();
        }
        state.expressionMode = GGG::Encoding;
        return;
      }
    }


    void parseEncoding( Char _char ) {
      if ( parseEndOfNumber( _char ) ) {
        // We're done
      } else if ( _char == GGG::Comment ) {
        skipToEndOfLine();
      } else if ( _char == GGG::Zero ) {
        startNumber();
        bufferAppend( _char );
        state.dataMode = GGG::Zero;
      } else if ( _char == GGG::Quote ) {
        startQuotedString();
      } else if ( isNumberStart( _char ) ) {
        startNumber();
        bufferAppend( _char );
      } else if ( _char == GGG::StringToEOL ) {
        startStringToEOL();
      } else {
        _char = CasedString( _char );
        if ( _char == GGG::EncodedOne ) {
          finishCompound();
          dataAppend( 1. );
        } else if ( _char == GGG::EncodedZero ) {
          finishCompound();
          dataAppend( 0. );
        } else if ( _char == GGG::EncodedMinusOne ) {
          finishCompound();
          dataAppend( -1. );
        }
      }
    }

    void parseAfterZero( Char _char ) {
      switch( toupper( _char ) ) {
        case HexNumber: startHex( 0, false ); break;
        case HexList1: startHex( 1, false ); break;
        case HexList2: startHex( 2, false ); break;
        case HexNorm1: startHex( 1, true );  break;
        case HexNorm2: startHex( 2, true );  break;

        default:
          state.expressionMode = GGG::Data;
          state.dataMode = GGG::Value;
          bufferAppend( _char );
          break;
      }
    }



    void parseData( Char _char ) {
      if ( state.dataMode == GGG::Value ) {
        bufferAppend( _char );
      } else if ( state.dataMode == GGG::Quote ) {
        if ( _char == Quote ) {
          dataAppend( state.argBuffer );
          state.argBuffer.clear();
        } else if ( _char == Escape ) {
          state.dataMode = GGG::Escape;
        } else {
          bufferAppend( _char );
        }
      } else if ( state.dataMode == GGG::Escape ) {
        if ( _char == Quote ) {
          bufferAppend( _char );
        } else {
          bufferAppend( Escape );
          bufferAppend( _char );
        }
        state.dataMode = GGG::Quote;
      } else if ( parseEndOfNumber( _char ) ) {
        // We're done
      } else if ( state.dataMode == GGG::HexNumber ) {
        parseHex( _char );
      } else if ( state.dataMode == GGG::Zero ) {
        parseAfterZero( _char );
      } else if ( state.dataMode == GGG::Number ) {
        bufferAppend( _char );
      } else if ( state.dataMode == GGG::HexNumber ) {
        parseHex( _char );
      }
    }


    bool parseEndOfNumber( Char _char ) {
      switch( _char ) {
        case EndArgument:
          finishCompound();
          finishArg();
          return true;

        case Comma:
          finishCompound();
          resetEncoding();
          return true;

        case ':':
        case '/':
        case '>':
        case '<':
        case '*':
        case '|':
          finishNumber();
          state.symbols.push_back( _char );
          return true;
      }
      return false;
    }

    void resetEncoding() {
      state.expressionMode = GGG::Encoding;
    }

    void parseHex( Char _char ) {
      bool wasHex = false;
      int digit = 0;
      if ( (_char >= '0') && (_char <= '9') ) {
        digit = _char - '0';
        wasHex = true;
      } else if ( (_char >= 'A') && (_char <= 'F') ) {
        digit = _char - 'A' + 10;
        wasHex = true;
      } else if ( (_char >= 'a') && (_char <= 'f') ) {
        digit = _char - 'a' + 10;
        wasHex = true;
      }
      if ( wasHex ) {
        if ( state.hexDigit < 7 ) {
          state.hexAccum = ( state.hexAccum << 4 ) | digit;
          state.hexDigit++;
        }
        if ( state.hexDigitCount > 0 && state.hexDigit == state.hexDigitCount ) {
          NumberType value = state.hexAccum;
          if ( state.hexNormalize ) {
            value /= float( (1 << ( state.hexDigit * 4 )) - 1 );
          }
          state.numbers.push_back( value );
          state.hexDigit = 0;
          state.hexAccum = 0;
          finishCompound();
        }
      }
    }

    void finishNumber() {
      if ( state.dataMode == GGG::HexNumber && state.hexDigit > 0 && state.hexDigitCount == 0 ) {
        NumberType value = float(state.hexAccum);
        if ( state.hexNormalize ) {
          value /= float( (1 << ( state.hexDigit * 4 )) - 1 );
        }
        state.numbers.push_back( value );
      } else if ( !state.argBuffer.empty() && state.dataMode == GGG::Number ) {
        std::stringstream ss(state.argBuffer);
        NumberType value;
        if (ss >> value) {
          state.numbers.push_back( value );
        }
        state.argBuffer.clear();
      }
    }

    // void finishSegment( Char _char ) {
    //   finishNumber();
    //   if ( state.compoundIndex < limits.maxAxes ) {
    //     state.compoundAxes[state.compoundIndex].ingest( state.value, _char );
    //     state.compoundIndex++;
    //   }
    // }

    void finishCompound() {
      finishNumber();
      if ( state.numbers.size() > 0 ) {
        for ( NumberType value : state.numbers ) {
          dataAppend( value );
        }
        state.numbers.clear();
      }
      state.symbols.clear();
    }

    void finishArg() {
      finishCompound();
      switch ( state.expressionMode ) {
        case GGG::Data:
        case GGG::Encoding:
          // finishData();
          if ( state.lineMode == GGG::Argument && !state.skipData && command ) {
            command->hookArg();
          }
        break;

        default:
          break;
      }
      state.expressionMode = GGG::Code;
      state.lineMode = GGG::Argument;
      state.dataMode = GGG::Skip;
      state.skipData = false;
    }


    void finishCommand() {
      if ( state.lineMode == GGG::Argument ) {
        finishArg();
        if ( command ) {
          command->hookFinish();
        }
        state.lineMode = GGG::Skip;
      }
    }

    void finishString() {
      finishArg();
      if ( command ) {
        command->hookString();
      }
      resetLine();
    }

    void finishLine() {
      finishArg();
      if ( command ) {
        command->hookFinish();
      }
      resetLine();
    }




    void skipToEndOfData() {
      state.expressionMode = GGG::Data;
      state.skipData = true;
    }

    void skipToEndOfLine() {
      state.lineMode = GGG::Comment;
    }

    void startNumber() {
      state.argBuffer.clear();
      state.expressionMode = GGG::Data;
      state.dataMode = GGG::Number;
    }

    void startHex( int _digitCount, bool _normalize ) {
      state.argBuffer.clear();
      state.expressionMode = GGG::Data;
      state.dataMode = GGG::HexNumber;
      state.hexDigitCount = _digitCount;
      state.hexNormalize = _normalize;
      state.hexAccum = 0;
      state.hexDigit = 0;
    }

    void startQuotedString() {
      state.expressionMode = GGG::Data;
      state.dataMode = GGG::Quote;
    }

    void startStringToEOL() {
      state.argBuffer.clear();
      state.expressionMode = GGG::Data;
      state.dataMode = GGG::End;
    }

    void dataAppend( NumberType value ) {
      if ( state.skipData ) {
        return;
      }
      
      if ( state.lineMode == GGG::Command ) {
        skipToEndOfData();
        loadCommand( value );
        return;
      }

      if ( command ) {
        command->code = state.code;
        command->number = value;
        command->hookNumber();
      }
    }

    void dataAppend( String value ) {
      if ( state.skipData ) {
        return;
      }

      if ( command ) {
        command->code = state.code;
        command->string = state.string;
        command->hookString();
      }
    }

    void bufferAppend( Char _char ) {
      state.argBuffer.push_back( _char );
    }


    void loadCommand( NumberType number ) {
      if ( state.code ) {
        int commandNumber = number;

        std::ostringstream oss;
        oss << state.code  << commandNumber;
        String commandName = oss.str();
        CommandType *commandNext = commands->getByName( commandName );

        if ( commandNext ) {
          command = commandNext;
          command->hookCommand();
          state.expressionMode = GGG::Code;
          state.lineMode = GGG::Argument;
          return;
        } else {
          // TODO: Command not found

          if ( commandName != "O1" ) {
            output( "; ");
            output( commandName );
            output( " ; command not found\n" );
            outputOK();
          } 

          command = nullptr;
        }
      }
    }

    void addCommand( CommandType * command ) {
      command->machine = this;
      commands->append( command );
    }

    void output( String str ) {
      std::cout << str;
    }

    void output( Char chr ) {
      std::cout << chr;
    }

    void outputInteger( Int value ) {
      std::cout << value;
    }

    void outputOK( Int value = 1 ) {
      output( GGG::Okay );
      if ( value == 1 ) {
        output( GGG::EncodedOne );
      } else if ( value == 0 ) {
        output( GGG::EncodedZero );
      } else if ( value == -1 ) {
        output( GGG::EncodedMinusOne );
      } else {
        outputInteger( value );
      }
      output( GGG::End );
    }
  };

}; // namespace ggg