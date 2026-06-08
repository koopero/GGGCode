#pragma once

#include "./Types.h"
#include "./List.h"
#include "./Command.h"
#include "./Matrix.h"
#include "./Solve.h"
#include "./Flow.h"
#include "./ggg/Limits.h"

namespace ggg {
  struct MachineState {
    GGG lineMode = GGG::Command;
    GGG expressionMode = GGG::Code;
    Char dataMode;  // holds a code from either the GGG or HexEncodings enum

    bool skipData = false;
    bool skipLine = false;

    // Flow control: record the raw line source (comments excluded) so a capture
    // frame can store a procedure body verbatim; captureLine commits it on EOL.
    bool recording = true;
    bool captureLine = false;

    // Reference parsing ($name / $name[subscript]). refInSub is true while the
    // bracketed subscript text is being captured into refSub; refHasSub records
    // that a subscript was present so finishReference resolves it instead of a
    // bare whole-register read.
    bool refInSub = false;
    bool refHasSub = false;
    bool refOffset = false;   // $x@[...]: yield coordinate offsets, not values
    String refSub;

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
    // Register table of matrices addressed by index (R) or name (L). Populated
    // by addRegister() -- e.g. grizzlar appends one entry per published buffer.
    List<MatrixBase> *registers = new List<MatrixBase>();
    List<CommandType> *commands = new List<CommandType>();

    // Flow control: active control frames (the command gate consults the top
    // one), procedure bodies (T registers), and a pending-lines queue that T11
    // drains after the current line so re-running a body is not re-entrant.
    std::vector<ControlFrame*> frames;
    List<TProcedure> *procedures = new List<TProcedure>();
    std::vector<PendingItem> pending;
    bool draining = false;

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
      state.line.clear();
      state.recording = true;
      state.captureLine = false;
      state.refInSub = false;
      state.refHasSub = false;
      state.refOffset = false;
      state.refSub.clear();
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

      // Record raw line source for flow-control capture. Stops at a comment so
      // captured procedure bodies exclude comments (matches TS ParseLine).
      if ( state.recording ) {
        if ( _char == GGG::Comment ) state.recording = false;
        else state.line += _char;
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
                state.expressionMode = GGG::Encoding;
                NumberType uval;
                if ( unitaryValue( state.utf8Accum, uval ) ) {
                  // Symbolic unitary (π/τ/φ/γ): a value / range bound, like K/Z/N.
                  state.numbers.push_back( uval );
                } else {
                  // Any other character decodes to its code point.
                  finishCompound();
                  dataAppend( (NumberType)state.utf8Accum );
                }
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
            parseRegister( _char );
            break;

          case GGG::Data:
            parseData( _char );
            break;
    
          default:
            break;
        }
      }
    }

    // Symbolic unitary constants — map a Unicode code point to its value (mirrors
    // the irrational entries of UnitaryValues in ts/ggg/Language.ts). π/τ/φ/γ enter
    // as multi-byte UTF-8 code points; e/E (Euler) arrive as ASCII. K/Z/N are the
    // exact unitaries and are handled separately. NumberType is float, so values
    // round to float precision and rely on the conformance value-tolerance to agree
    // with the TS double reference.
    static bool unitaryValue( uint32_t codepoint, NumberType &out ) {
      switch ( codepoint ) {
        case 0x03C0: out = (NumberType) 3.141592653589793;  return true;  // π  pi
        case 0x03C4: out = (NumberType) 6.283185307179586;  return true;  // τ  2π
        case 0x03C6: out = (NumberType) 1.618033988749895;  return true;  // φ  golden ratio
        case 0x03B3: out = (NumberType) 0.5772156649;       return true;  // γ  Euler–Mascheroni
        case 'e': case 'E': out = (NumberType) 2.718281828459045; return true; // Euler's number
        default: return false;
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
      } else if ( _char == GGG::Reference ) {
        // Start of a $name reference. A bare $name reads the whole register; a
        // following [subscript] selects specific indices (see parseRegister /
        // resolveReferenceSubscript).
        state.expressionMode = GGG::Register;
        state.argBuffer.clear();
        state.refSub.clear();
        state.refInSub = false;
        state.refHasSub = false;
        state.refOffset = false;
      } else if ( isNumberStart( _char ) ) {
        startNumber();
        bufferAppend( _char );
      } else if ( _char == GGG::StringToEOL ) {
        startStringToEOL();
      } else {
        // Unitary constants (K=1, Z=0, N=-1, and the ASCII symbolic e=Euler) are
        // values like any number: push them into the compound so they can be a
        // range/axis bound (K:5, Z>10), not emitted immediately. A following
        // separator is handled by the parseEndOfNumber() at the top of parseEncoding().
        NumberType uval;
        if ( unitaryValue( (uint32_t)(uint8_t)_char, uval ) ) {
          state.numbers.push_back( uval );
        } else {
          _char = CasedString( _char );
          if ( _char == GGG::EncodedOne ) {
            state.numbers.push_back( 1. );
          } else if ( _char == EncodedZero ) {
            state.numbers.push_back( 0. );
          } else if ( _char == EncodedMinusOne ) {
            state.numbers.push_back( -1. );
          }
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
          state.dataMode = GGG::Number;
          bufferAppend( _char );
          break;
      }
    }



    void parseData( Char _char ) {
      if ( state.dataMode == GGG::Quote ) {
        if ( _char == Quote ) {
          dataAppend( state.argBuffer );
          state.argBuffer.clear();
          // Leave quote mode cleanly so the trailing separator / following args
          // parse normally (a closing quote ends the string, not the line).
          state.expressionMode = GGG::Code;
          state.dataMode = GGG::Skip;
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
      } else if ( state.dataMode == HexNumber ) {
        parseHex( _char );
      } else if ( state.dataMode == GGG::Zero ) {
        parseAfterZero( _char );
      } else if ( state.dataMode == GGG::Number ) {
        bufferAppend( _char );
      } else if ( state.dataMode == HexNumber ) {
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

    // Streaming $name reference parser. Accumulates the register name into
    // argBuffer; a bare reference reads the whole register (every scalar in
    // order). A '[' switches to capturing the subscript text into refSub up to
    // its ']', then resolveReferenceSubscript selects the indexed scalars.
    // Mirrors Solve.solveReference in TS.
    void parseRegister( Char _char ) {
      if ( state.refInSub ) {
        if ( _char == GGG::SubscriptEnd ) {
          state.refInSub = false;
          finishReference();
        } else {
          state.refSub += _char;
        }
        return;
      }
      bool isNameChar =
        ( _char >= 'a' && _char <= 'z' ) || ( _char >= 'A' && _char <= 'Z' ) ||
        ( _char >= '0' && _char <= '9' ) || _char == '_';
      if ( isNameChar ) {
        state.argBuffer += _char;
        return;
      }
      if ( _char == GGG::At ) {              // '@' -> offset reference ($x@[...])
        state.refOffset = true;
        return;
      }
      if ( _char == GGG::Subscript ) {       // '[' -> capture subscript
        state.refHasSub = true;
        state.refInSub = true;
        return;
      }
      finishReference();
      parseEndOfNumber( _char );             // handle space/comma/range terminator
    }

    void finishReference() {
      state.expressionMode = GGG::Encoding;
      if ( !state.argBuffer.empty() ) {
        if ( state.refHasSub && state.refOffset ) {
          resolveOffsetSubscript( state.argBuffer, state.refSub );
        } else if ( state.refHasSub ) {
          resolveReferenceSubscript( state.argBuffer, state.refSub );
        } else {
          resolveReference( state.argBuffer );
        }
      }
      state.argBuffer.clear();
      state.refSub.clear();
      state.refInSub = false;
      state.refHasSub = false;
      state.refOffset = false;
    }

    // Resolve a register by name, falling back to an index lookup for a numeric
    // name (matches TS NamedList.get, so "0" resolves to register index 0). This
    // is the universal name-or-index resolution the R selector arg uses.
    MatrixBase * resolveRegisterByName( const String & name ) {
      MatrixBase * reg = registers->getByName( name );
      if ( !reg && !name.empty() ) {
        bool numeric = true;
        for ( char c : name ) if ( c < '0' || c > '9' ) { numeric = false; break; }
        if ( numeric ) reg = registers->getByIndex( std::stoi( name ) );
      }
      return reg;
    }

    void resolveReference( const String & name ) {
      MatrixBase * reg = resolveRegisterByName( name );
      if ( !reg ) return;                    // unknown register -> no values
      Index n = reg->sizeScalar();
      for ( Index i = 0; i < n; i++ ) {
        dataAppend( reg->readScalarFloat( i, 0. ) );
      }
    }

    // Read one register scalar by index, appending it as a value. Skips NaN /
    // out-of-range reads (mirrors Solve.isUsable in the TS reference).
    void readReferenceIndex( MatrixBase * reg, NumberType idxF ) {
      if ( std::isnan( idxF ) ) return;
      NumberType val = reg->readScalarFloat( (Index) idxF, NAN );
      if ( !std::isnan( val ) ) dataAppend( val );
    }

    // One comma-separated subscript segment: a compound (numbers + the range
    // symbols seen between them), in the ParseData grammar.
    struct SubSegment { std::vector<NumberType> numbers; std::vector<Char> symbols; };

    // Tokenize a subscript into its comma-separated compound segments. Shared by
    // the plain ($x[...]) and offset ($x@[...]) resolvers.
    std::vector<SubSegment> parseSubscriptSegments( const String & sub ) {
      std::vector<SubSegment> segs;
      std::vector<NumberType> numbers;
      std::vector<Char> symbols;
      String num;
      auto flushNumber = [&]() {
        if ( num.empty() ) return;
        std::stringstream ss( num );
        NumberType v;
        if ( ss >> v ) numbers.push_back( v );
        num.clear();
      };
      auto flushSegment = [&]() {
        flushNumber();
        if ( numbers.empty() && symbols.empty() ) return;
        segs.push_back( { numbers, symbols } );
        numbers.clear();
        symbols.clear();
      };
      for ( char c : sub ) {
        if ( ( c >= '0' && c <= '9' ) || c == '.' || c == '+' || c == '-' ) {
          num += c;
        } else if ( c == GGG::Comma ) {
          flushSegment();
        } else if ( c == GGG::Range || c == GGG::Uninclusive || c == '<' ||
                    c == GGG::Count || c == GGG::Multiplier || c == GGG::NextAxis ) {
          flushNumber();
          symbols.push_back( c );
        }
        // any other char (whitespace, etc.) is ignored
      }
      flushSegment();
      return segs;
    }

    // Resolve $name[subscript]: each segment is solved into a set of flat indices,
    // and every index reads one scalar. Mirrors Solve.solveReference (ts/ggg/Solve.ts):
    // the subscript is solved REGISTER-LESS (dimension 1, stride 1 per axis) --
    // Solve.solve drops the register when recursing into the subscript array, so
    // the register's shape never sizes the ranges; it only supplies the values
    // read by the resolved indices. Multi-axis (a|b) thus expands coordinate-wise
    // into flat indices exactly like the register-less print compound.
    void resolveReferenceSubscript( const String & name, const String & sub ) {
      MatrixBase * reg = resolveRegisterByName( name );
      if ( !reg ) return;
      for ( auto & seg : parseSubscriptSegments( sub ) ) {
        if ( seg.numbers.size() == 1 && seg.symbols.empty() ) {
          readReferenceIndex( reg, seg.numbers[0] );
        } else {
          CompoundExpansion expansion( buildAxes( seg.numbers, seg.symbols ) );   // register-less
          NumberType v;
          while ( expansion.next( v ) ) readReferenceIndex( reg, v );
        }
      }
    }

    // Resolve $name@[subscript]: an OFFSET reference. Each segment's coordinates
    // resolve against the register's per-axis dimensions/strides, and the flat
    // OFFSETS are yielded (not the values). A lone coordinate value is an EXACT
    // coordinate (a single point), so blank-end axes are pinned to start; explicit
    // ranges (a:b) still sweep coordinates. Mirrors the offset branch of
    // Solve.solveReference (ts/ggg/Solve.ts).
    void resolveOffsetSubscript( const String & name, const String & sub ) {
      MatrixBase * reg = resolveRegisterByName( name );
      if ( !reg ) return;
      for ( auto & seg : parseSubscriptSegments( sub ) ) {
        std::vector<RangeAxis> axes = buildAxes( seg.numbers, seg.symbols );
        // Pin lone values (blank end) to a single coordinate at start.
        for ( auto & a : axes ) {
          if ( std::isnan( a.end ) ) { a.end = a.start; a.inclusive = true; }
        }
        // Per-axis dimensions + strides from the register shape (axis 0 innermost,
        // stride 1); axes beyond the register's rank use dimension 1.
        std::vector<NumberType> dims, strides;
        NumberType stride = 1;
        for ( size_t k = 0; k < axes.size(); k++ ) {
          NumberType d = ( k < reg->dim.size() ) ? (NumberType) reg->dim[k] : 1;
          dims.push_back( d );
          strides.push_back( stride );
          stride *= d;
        }
        CompoundExpansion expansion( axes, dims, strides );
        NumberType v;
        while ( expansion.next( v ) ) dataAppend( v );   // yield the flat offset
      }
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
      if ( state.dataMode == HexNumber && state.hexDigit > 0 && state.hexDigitCount == 0 ) {
        NumberType value = float(state.hexAccum);
        if ( state.hexNormalize ) {
          value /= float( (1 << ( state.hexDigit * 4 )) - 1 );
        }
        state.numbers.push_back( value );
      } else if ( !state.argBuffer.empty() && ( state.dataMode == GGG::Number || state.dataMode == GGG::Zero ) ) {
        std::stringstream ss(state.argBuffer);
        NumberType value;
        if (ss >> value) {
          state.numbers.push_back( value );
        }
        state.argBuffer.clear();
      }
    }

    void finishCompound() {
      finishNumber();
      if ( state.numbers.empty() && state.symbols.empty() ) {
        return;
      }
      if ( state.numbers.size() == 1 && state.symbols.empty() ) {
        // Plain bare number -- no range / axis modifiers.
        dataAppend( state.numbers[0] );
      } else {
        // Range or multi-axis expression: fold numbers + symbols into axes and
        // stream them (mirrors ParseData.parseExpression + Solve in the TS
        // reference). CompoundExpansion is a lazy pull iterator -- one value at
        // a time, O(axes) memory, and cancellable mid-flight: we stop pulling
        // the moment skipData is set, since every further value would be
        // discarded by dataAppend anyway.
        CompoundExpansion expansion( buildAxes( state.numbers, state.symbols ) );
        NumberType value;
        while ( expansion.next( value ) ) {
          dataAppend( value );
          if ( state.skipData ) break;
        }
      }
      state.numbers.clear();
      state.symbols.clear();
    }

    void finishArg() {
      // Resolve a pending bare reference whose terminator was end-of-line (so
      // parseRegister never saw a separator).
      if ( state.expressionMode == GGG::Register ) {
        state.refInSub = false;
        finishReference();
      }
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
      // Commit a captured body line to the top frame (gate decided Capture).
      if ( state.captureLine && !frames.empty() ) {
        frames.back()->captureLine( trimSource( state.line ) );
      }
      resetLine();
      drainPending();
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
      state.dataMode = HexNumber;
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
        command->string = value;
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

        // Command gate: before dispatching a now-formalized command, let the top
        // control frame decide run/capture/skip/error. On capture/skip the rest
        // of the line is consumed (Skip mode) without dispatching command hooks;
        // source recording continues so the line can be committed at EOL.
        if ( !frames.empty() ) {
          CommandView view{ commandName, state.code, number };
          CommandDecision decision = frames.back()->beforeCommand( *this, view );
          if ( decision != CommandDecision::Run ) {
            if ( decision == CommandDecision::Capture ) state.captureLine = true;
            else if ( decision == CommandDecision::Error ) outputOK( 0 );
            command = nullptr;
            state.lineMode = GGG::Skip;
            return;
          }
        }

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

    // Register table. append() assigns each matrix item->index in call order, so
    // addRegister() in buffer-index order makes getRegister(R) == that buffer.
    void addRegister( MatrixBase * matrix ) {
      registers->append( matrix );
    }

    MatrixBase * getRegister( Index index ) {
      return registers->getByIndex( index );
    }

    // --- Control frames + procedures --------------------------------------

    void pushFrame( ControlFrame * frame ) {
      frames.push_back( frame );
    }

    void popFrame() {
      if ( !frames.empty() ) {
        delete frames.back();
        frames.pop_back();
      }
    }

    // Resolve a procedure body by name, optionally creating it. Bodies live in
    // the T-owned `procedures` list, addressable by name (L) or index (R).
    TProcedure * getProcedure( const String & name, bool create ) {
      TProcedure * reg = procedures->getByName( name );
      if ( !reg && create ) {
        reg = new TProcedure();
        reg->name = name;
        procedures->append( reg );
      }
      return reg;
    }

    // Queue procedure source lines to run after the current line. Inserting at
    // the front keeps nested calls (a body that runs another procedure) in the
    // right order, mirroring the TS splice-after-current. Bounded by maxQueue.
    void enqueueLines( const std::vector<String> & lines ) {
      if ( limits.maxQueue && (Int)( pending.size() + lines.size() ) > limits.maxQueue ) {
        outputOK( 0 );
        return;
      }
      std::vector<PendingItem> items;
      for ( const String & l : lines ) items.push_back( { false, l, {} } );
      pending.insert( pending.begin(), items.begin(), items.end() );
    }

    // Run a captured body once per value, writing each value into the iteration
    // register (callback) immediately before its body copy so the body reads the
    // current value via a reference ($name / $index). Bounded by maxQueue.
    void enqueueLoop( const std::vector<NumberType> & values, const std::vector<String> & body,
                      bool hasReg, bool regByName, const String & regName, Index regIndex ) {
      std::vector<PendingItem> items;
      for ( NumberType v : values ) {
        if ( hasReg ) {
          items.push_back( { true, "", [this, v, hasReg, regByName, regName, regIndex]() {
            this->setIterRegister( regByName, regName, regIndex, v );
          } } );
        }
        for ( const String & l : body ) items.push_back( { false, l, {} } );
      }
      if ( limits.maxQueue && (Int)( pending.size() + items.size() ) > limits.maxQueue ) {
        outputOK( 0 );
        return;
      }
      pending.insert( pending.begin(), items.begin(), items.end() );
    }

    // Write a scalar into the iteration register (a single-element Matrix,
    // addressable by name or index), creating it if missing, so a loop body can
    // read it as $name / $index.
    void setIterRegister( bool byName, const String & name, Index index, NumberType value ) {
      MatrixBase * reg = byName ? registers->getByName( name ) : registers->getByIndex( index );
      if ( !reg ) {
        auto * m = new Matrix<float, false>( { 1 } );   // single scalar
        m->allocate();
        if ( byName ) m->name = name;
        addRegister( m );
        reg = m;
      }
      reg->writeScalarFloat( value, 0 );
    }

    // Drain queued procedure/loop items by feeding lines back through the parser
    // and running callbacks. The re-entrancy guard lets a nested enqueue (from a
    // body line) push onto the front while this outer loop keeps draining in order.
    void drainPending() {
      if ( draining ) return;
      draining = true;
      while ( !pending.empty() ) {
        PendingItem item = pending.front();
        pending.erase( pending.begin() );
        if ( item.isCallback ) {
          if ( item.callback ) item.callback();
        } else {
          String line = item.line + (char) GGG::End;
          for ( Char c : line ) parse( c );
        }
      }
      draining = false;
    }

    // All command output funnels through write(). Override it to redirect
    // output -- e.g. to a buffer for conformance tests, or to Serial on
    // embedded targets where std::cout is unavailable.
    virtual void write( const String &str ) {
      std::cout << str;
    }

    void output( String str ) {
      write( str );
    }

    void output( Char chr ) {
      write( String( 1, chr ) );
    }

    void outputInteger( Int value ) {
      write( std::to_string( value ) );
    }

    void outputOK( Int value = 1 ) {
      output( GGG::Okay );
      if ( value == 1 ) {
        output( GGG::EncodedOne );
      } else if ( value == 0 ) {
        output( EncodedZero );
      } else if ( value == -1 ) {
        output( EncodedMinusOne );
      } else {
        outputInteger( value );
      }
      output( GGG::End );
    }
  };

}; // namespace ggg