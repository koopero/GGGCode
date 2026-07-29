#pragma once

#include <cstdio>
#include <limits>
#include "./Types.h"
#include "./List.h"
#include "./Command.h"
#include "./Matrix.h"
#include "./Solve.h"
#if GGGTX_ENABLE
#include "./Flow.h"
#endif
#include "./ggg/Limits.h"
#include "./ggg/NumberOps.h"

namespace ggg {
  template <class T = DefaultTraits>
  struct MachineStateT {
    using Number = typename T::Number;

    GGG lineMode = GGG::Command;
    GGG expressionMode = GGG::Code;
    Char dataMode;  // holds a code from either the GGG or HexEncodings enum

    bool skipData = false;
    bool skipLine = false;

    #if GGGTX_ENABLE
    // Flow control: record the raw line source (comments excluded) so a capture
    // frame can store a procedure body verbatim; captureLine commits it on EOL.
    bool recording = true;
    bool captureLine = false;
    #endif

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
    Number value;
    String string;
    #if GGGTX_ENABLE
    String line;
    #endif
    String comment;
    String argBuffer;

    std::vector<Number> numbers;
    std::vector<Char> symbols;

    unsigned long hexAccum;
    Index hexDigit;
    Index hexDigitCount;
    bool hexNormalize;

    uint32_t utf8Accum = 0;
    int utf8Remaining = 0;

    // A bare "-"/"+" that finishNumber could not turn into a number, held for the
    // constant that follows it ("-π"). Constants never reach finishNumber, so
    // without this the sign is discarded and the value comes out positive.
    bool pendingNegative = false;
  };
  using MachineState = MachineStateT<>;


  template <class T = DefaultTraits>
  class MachineT {
  public:
    using Number = typename T::Number;

    MachineLimits limits;
    MachineStateT<T> state;
    CommandTypeT<T> *command = nullptr;
    // Request id (the O<id> arg) echoed on this line's return so it can be
    // correlated; defaults to 1, which renders the terminator as OK.
    Int requestId = 1;
    // Register table of matrices addressed by index (R) or name (L). Populated
    // by addRegister() -- e.g. grizzlar appends one entry per published buffer.
    List<MatrixBaseT<T>> *registers = new List<MatrixBaseT<T>>();
    List<CommandTypeT<T>> *commands = new List<CommandTypeT<T>>();
    #if GGGDX_ENABLE
    // Sorted stable EnumGroupIndex values used by the loaded command metadata.
    // D1/D5 walk this machine-scoped set, so extensions advertise only the
    // domains they actually make available.
    std::vector<Int> enumDomains;
    #endif

    #if GGGTX_ENABLE
    // Flow control: active control frames (the command gate consults the top
    // one), procedure bodies (T registers), and a pending-lines queue that T11
    // drains after the current line so re-running a body is not re-entrant.
    std::vector<ControlFrameT<T>*> frames;
    List<TProcedure> *procedures = new List<TProcedure>();
    std::vector<PendingItem> pending;
    bool draining = false;

    // Procedures exported as asynchronous (T12), fired by the host via poll().
    // Insertion-ordered: due procedures run in the order they were exported.
    std::vector<AsyncProcedure> schedule;
    #endif

    MachineT() {
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
      requestId = 1;
      state.lineMode = GGG::Command;
      state.expressionMode = GGG::Code;
      state.argBuffer.clear();
      #if GGGTX_ENABLE
      state.line.clear();
      state.recording = true;
      state.captureLine = false;
      #endif
      state.refInSub = false;
      state.refHasSub = false;
      state.refOffset = false;
      state.refSub.clear();
      state.pendingNegative = false;
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

      #if GGGTX_ENABLE
      // Record raw line source for flow-control capture. Stops at a comment so
      // captured procedure bodies exclude comments (matches TS ParseLine).
      if ( state.recording ) {
        if ( _char == GGG::Comment ) state.recording = false;
        else state.line += _char;
      }
      #endif

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
                Number uval;
                if ( !unitaryValue( state.utf8Accum, uval ) ) {
                  // Any other character decodes to its code point.
                  uval = (Number) state.utf8Accum;
                }
                // Both kinds feed the compound (state.numbers) rather than being
                // appended immediately, so a code point works as a range bound
                // exactly like a symbolic unitary does -- "V☃:9735" sweeps.
                pushCompoundNumber( uval * takePendingSign() );
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
    // as multi-byte UTF-8 code points. K/Z/N are the
    // exact unitaries and are handled separately. The literals are written at
    // NumberOps supplies the representation-specific spelling. The fixed-point
    // implementation constructs these constants from decimal digits with no
    // floating-point intermediate.
    // The ASCII unitary letters (K/Z/N). A number is COMPLETE when one arrives:
    // "5K" is two values, not the number "5K". Euler's e was retired precisely
    // so no unitary collides with the exponent marker, which must keep
    // accumulating into the number ("5e4" is 50000, not 5 then e).
    static bool isUnitaryAscii( Char _char ) {
      const Char u = CasedString( _char );
      return u == GGG::EncodedOne || u == EncodedZero || u == EncodedMinusOne;
    }

    // Can _char extend the decimal number already in argBuffer? Mirrors the float
    // grammar parseFloat accepts: digits, a single ".", a single exponent marker
    // after at least one digit, and a sign ONLY straight after that marker. Any
    // other character means the number is complete.
    bool numberCanContinue( Char _char ) const {
      const String &b = state.argBuffer;
      if ( _char >= '0' && _char <= '9' ) return true;

      const bool hasExp = b.find('e') != String::npos || b.find('E') != String::npos;

      if ( _char == '.' ) return !hasExp && b.find('.') == String::npos;

      if ( _char == 'e' || _char == 'E' ) {
        if ( hasExp ) return false;
        for ( Char c : b ) if ( c >= '0' && c <= '9' ) return true;
        return false;   // "e" with no digits before it is not an exponent
      }

      if ( _char == '-' || _char == '+' ) {
        return !b.empty() && ( b.back() == 'e' || b.back() == 'E' );
      }

      return false;
    }

    // A lone pending sign belongs to the constant that follows it ("-π" is
    // -3.14159). Consumed here because a constant never reaches finishNumber, so
    // the buffered sign would otherwise be dropped and the value come out
    // POSITIVE. Only a bare sign qualifies.
    Number takePendingSign() {
      bool negative = false;
      if ( state.dataMode == GGG::Number && ( state.argBuffer == "-" || state.argBuffer == "+" ) ) {
        negative = ( state.argBuffer == "-" );
        state.argBuffer.clear();
      } else if ( state.pendingNegative ) {
        negative = true;
      }
      state.pendingNegative = false;
      return negative ? (Number) -1 : (Number) 1;
    }

    static bool unitaryValue( uint32_t codepoint, Number &out ) {
      switch ( codepoint ) {
        case 0x03C0: out = NumberOps<Number>::pi();       return true;  // π  pi
        case 0x03C4: out = NumberOps<Number>::tau();      return true;  // τ  2π
        case 0x03C6: out = NumberOps<Number>::phi();      return true;  // φ  golden ratio
        case 0x221E: out = NumberOps<Number>::infinity(); return true; // ∞  infinity
        case 0x03B3: out = NumberOps<Number>::gamma();    return true;  // γ  Euler–Mascheroni
        default: return false;
      }
    }

    void parseCode( Char _char ) {
      if (  _char == ';' ) {
        skipToEndOfLine();
        return;
      }

      // A comma here can only follow a just-closed quoted string (a string value
      // is delivered at its closing quote, leaving Code mode). Continue the value
      // list under the same code, so E"a","b" delivers both strings -- mirrors the
      // TS parser + the number-list comma in parseEndOfNumber. Without this the
      // comma and everything after it are dropped.
      if ( _char == Comma ) {
        resetEncoding();
        return;
      }

      if (( _char >= 'a' && _char <= 'z' ) || ( _char >= 'A' && _char <= 'Z' )) {
        _char = std::toupper(_char);
        state.code = _char;
        // A trailing O<id> is the universal request id (captured in dataAppend),
        // so don't dispatch it to the command. O is reserved for this.
        if ( state.lineMode == GGG::Argument && command && _char != GGG::Okay ) {
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
        // Unitary constants (K=1, Z=0, N=-1) are
        // values like any number: push them into the compound so they can be a
        // range/axis bound (K:5, Z>10), not emitted immediately. A following
        // separator is handled by the parseEndOfNumber() at the top of parseEncoding().
        Number uval;
        const Char cased = CasedString( _char );
        if ( unitaryValue( (uint32_t)(uint8_t)_char, uval ) ) {
          pushCompoundNumber( uval * takePendingSign() );
        } else if ( cased == GGG::EncodedOne ) {
          pushCompoundNumber( takePendingSign() );
        } else if ( cased == EncodedZero ) {
          pushCompoundNumber( Number( 0 ) );
        } else if ( cased == EncodedMinusOne ) {
          pushCompoundNumber( Number( -1 ) * takePendingSign() );
        } else if ( ( _char >= 'a' && _char <= 'z' ) || ( _char >= 'A' && _char <= 'Z' ) ) {
          // Any other letter where a value was expected is the CODE of the next
          // argument, exactly as it is once a number has started (see parseData).
          // "Vinf" is the empty argument V, then I carrying the unitary n.
          finishArg();
          parseCode( _char );
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
        // A character the float grammar cannot absorb ENDS the number, and is then
        // re-dispatched in its own right rather than being swallowed into the
        // buffer. Without this "V5X10" parsed as the number "5X10" (yielding just
        // 5, the X10 lost) instead of V5 followed by the argument X10.
        if ( numberCanContinue( _char ) ) {
          bufferAppend( _char );
        } else if ( isUnitaryAscii( _char ) ) {
          // A unitary is a VALUE: complete the number, then parse it in place.
          finishNumber();
          state.expressionMode = GGG::Encoding;
          parseEncoding( _char );
        } else if ( ( _char >= 'a' && _char <= 'z' ) || ( _char >= 'A' && _char <= 'Z' ) ) {
          // Any other letter is the CODE of a new argument. finishArg resets to
          // Code mode and fires the completed argument's hook.
          finishArg();
          parseCode( _char );
        } else if ( _char == '-' || _char == '+' || _char == GGG::Period ) {
          // A sign, or a second decimal point, begins another value under the
          // same code (an implicit list): "1.2.3" is 1.2 then .3.
          finishCompound();
          resetEncoding();
          parseEncoding( _char );
        } else {
          bufferAppend( _char );
        }
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
    MatrixBaseT<T> * resolveRegisterByName( const String & name ) {
      MatrixBaseT<T> * reg = registers->getByName( name );
      if ( !reg && !name.empty() ) {
        bool numeric = true;
        for ( char c : name ) if ( c < '0' || c > '9' ) { numeric = false; break; }
        if ( numeric ) reg = registers->getByIndex( std::stoi( name ) );
      }
      return reg;
    }

    void resolveReference( const String & name ) {
      MatrixBaseT<T> * reg = resolveRegisterByName( name );
      if ( !reg ) return;                    // unknown register -> no values
      Index n = reg->sizeScalar();
      for ( Index i = 0; i < n; i++ ) {
        dataAppend( reg->readScalarFloat( i, 0 ) );
      }
    }

    // Read one register scalar by index, appending it as a value. Skips
    // unusable / out-of-range reads (mirrors Solve.isUsable in the TS
    // reference). The guard is written as !( idxF >= 0 ) so it rejects a NaN
    // index -- which compares false against everything -- without naming NaN.
    void readReferenceIndex( MatrixBaseT<T> * reg, Number idxF ) {
      if ( !( idxF >= 0 ) ) return;
      Number val;
      if ( reg->readScalarChecked( (Index) idxF, val ) ) dataAppend( val );
    }

    // One comma-separated subscript segment: a compound (numbers + the range
    // symbols seen between them), in the ParseData grammar.
    struct SubSegment { std::vector<Number> numbers; std::vector<Char> symbols; };

    // Tokenize a subscript into its comma-separated compound segments. Shared by
    // the plain ($x[...]) and offset ($x@[...]) resolvers.
    std::vector<SubSegment> parseSubscriptSegments( const String & sub ) {
      std::vector<SubSegment> segs;
      std::vector<Number> numbers;
      std::vector<Char> symbols;
      String num;
      // Same prefix parse as finishNumber, so both numeric entry points agree on
      // what a number is (and both tell "parsed nothing" the same way).
      auto flushNumber = [&]() {
        if ( num.empty() ) return;
        const char *begin = num.c_str();
        char *end = nullptr;
        const Number v = NumberOps<Number>::parse( begin, &end );
        if ( end != begin ) numbers.push_back( v );
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
      MatrixBaseT<T> * reg = resolveRegisterByName( name );
      if ( !reg ) return;
      for ( auto & seg : parseSubscriptSegments( sub ) ) {
        if ( seg.numbers.size() == 1 && seg.symbols.empty() ) {
          readReferenceIndex( reg, seg.numbers[0] );
        } else {
          // Coordinates register-less; an open axis sweeps to the register size.
          CompoundExpansionT<T> expansion( buildAxes<T>( seg.numbers, seg.symbols ), (Number) reg->sizeScalar() );
          Number v;
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
      MatrixBaseT<T> * reg = resolveRegisterByName( name );
      if ( !reg ) return;
      for ( auto & seg : parseSubscriptSegments( sub ) ) {
        std::vector<RangeAxisT<T>> axes = buildAxes<T>( seg.numbers, seg.symbols );
        // Lone values (blank end) are pinned to a single coordinate inside
        // CompoundExpansion (see pinBlankEnd / Solve.solveRangeAxes).
        // Per-axis dimensions + strides from the register shape (axis 0 innermost,
        // stride 1); axes beyond the register's rank use dimension 1.
        std::vector<Number> dims, strides;
        Number stride = 1;
        for ( size_t k = 0; k < axes.size(); k++ ) {
          Number d = ( k < reg->dim.size() ) ? (Number) reg->dim[k] : 1;
          dims.push_back( d );
          strides.push_back( stride );
          stride *= d;
        }
        CompoundExpansionT<T> expansion( axes, dims, strides );
        Number v;
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
          Number value = state.hexAccum;
          if ( state.hexNormalize ) {
            value = NumberOps<Number>::ratio(
              state.hexAccum, (1 << ( state.hexDigit * 4 )) - 1
            );
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
        Number value = state.hexAccum;
        if ( state.hexNormalize ) {
          value = NumberOps<Number>::ratio(
            state.hexAccum, (1 << ( state.hexDigit * 4 )) - 1
          );
        }
        pushCompoundNumber( value );
      } else if ( !state.argBuffer.empty() && ( state.dataMode == GGG::Number || state.dataMode == GGG::Zero ) ) {
        // NumberOps::parse consumes the longest valid numeric PREFIX, which is
        // what the reference's parseFloat does. A whole-buffer parse would throw
        // the number away entirely on a trailing float-syntax character -- "5e"
        // (exponent with no digits) or "5X" (hex-float prefix) -- instead of
        // yielding 5.
        //
        // Buffer is copied and cleared first: pushCompoundNumber can finish the
        // compound, which re-enters finishNumber.
        const String buf = state.argBuffer;
        state.argBuffer.clear();
        if ( buf == "-" || buf == "+" ) {
          state.pendingNegative = ( buf == "-" );
          return;
        }
        const char *begin = buf.c_str();
        char *end = nullptr;
        const Number parsed = NumberOps<Number>::parse( begin, &end );
        if ( end != begin ) {
          pushCompoundNumber( parsed );
        }
      }
    }

    // Feed a value into the compound. A value arriving with NO separator recorded
    // for its position starts a new value -- the reference parser completes a
    // value when the next one starts. Without this, buildAxes has no symbolBefore
    // to route the number by and silently drops it ("VK5", "V5K", "V<char><char>").
    void pushCompoundNumber( Number value ) {
      if ( !state.numbers.empty() && state.symbols.size() < state.numbers.size() ) {
        // emitCompound, NOT finishCompound: this can be reached from inside
        // finishNumber, and finishCompound would re-enter it with the number
        // still buffered.
        emitCompound();
      }
      state.numbers.push_back( value );
    }

    void finishCompound() {
      finishNumber();
      emitCompound();
    }

    // Flush whatever is already accumulated. Split out of finishCompound so the
    // adjacency guard can flush without re-running finishNumber.
    void emitCompound() {
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
        CompoundExpansionT<T> expansion( buildAxes<T>( state.numbers, state.symbols ) );
        Number value;
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
      state.pendingNegative = false;
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
      #if GGGTX_ENABLE
      // Commit a captured body line to the top frame (gate decided Capture).
      if ( state.captureLine && !frames.empty() ) {
        frames.back()->captureLine( trimSource( state.line ) );
      }
      #endif
      resetLine();
      #if GGGTX_ENABLE
      drainPending();
      #endif
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

    void dataAppend( Number value ) {
      if ( state.skipData ) {
        return;
      }
      
      if ( state.lineMode == GGG::Command ) {
        skipToEndOfData();
        loadCommand( value );
        return;
      }

      // Universal request id: a trailing O<id> tags the command's return. O is
      // reserved for this -- no command uses O as an arg code.
      if ( state.code == GGG::Okay ) {
        requestId = (Int) value;
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


    void loadCommand( Number number ) {
      if ( state.code ) {
        int commandNumber = (int) number;

        String commandName( 1, state.code );
        commandName += std::to_string( commandNumber );

        #if GGGTX_ENABLE
        // Command gate: before dispatching a now-formalized command, let the top
        // control frame decide run/capture/skip/error. On capture/skip the rest
        // of the line is consumed (Skip mode) without dispatching command hooks;
        // source recording continues so the line can be committed at EOL.
        if ( !frames.empty() ) {
          CommandViewT<T> view{ commandName, state.code, number };
          CommandDecision decision = frames.back()->beforeCommand( *this, view );
          if ( decision != CommandDecision::Run ) {
            if ( decision == CommandDecision::Capture ) state.captureLine = true;
            else if ( decision == CommandDecision::Error ) outputFail( (Int) GGGFail::StackError );
            command = nullptr;
            state.lineMode = GGG::Skip;
            return;
          }
        }
        #endif

        CommandTypeT<T> *commandNext = commands->getByName( commandName );

        if ( commandNext ) {
          command = commandNext;
          command->hookCommand();
          state.expressionMode = GGG::Code;
          state.lineMode = GGG::Argument;
          return;
        } else {
          // An O-prefixed "command" is a return line echoed back as input (OK,
          // O7, OZ, OK F6 ...). Skip the whole line so its trailing args (e.g.
          // F6) are not re-parsed as commands -- mirrors the TS isBlankCommand
          // suppression.
          if ( state.code == GGG::Okay ) {
            command = nullptr;
            state.lineMode = GGG::Skip;
            return;
          }

          output( "; " );
          output( commandName );
          output( " ; command not found\n" );
          outputFail( (Int) GGGFail::CommandNotFound );
          command = nullptr;
        }
      }
    }

    void addCommand( CommandTypeT<T> * command ) {
      command->machine = this;
      commands->append( command );
      #if GGGDX_ENABLE
      registerCommandMetadata( command );
      #endif
    }

    #if GGGDX_ENABLE
    void addEnumDomain( Int domain ) {
      if ( domain < 0 ) return;
      auto at = enumDomains.begin();
      while ( at != enumDomains.end() && *at < domain ) ++at;
      if ( at == enumDomains.end() || *at != domain ) enumDomains.insert( at, domain );
    }

    void registerCommandMetadata( CommandTypeT<T> * command ) {
      for ( const auto &arg : command->args ) addEnumDomain( arg.domain );
      for ( Int domain : command->domains ) addEnumDomain( domain );
      for ( auto *record : command->records ) registerCommandMetadata( record );
    }
    #endif

    // Register table. append() assigns each matrix item->index in call order, so
    // addRegister() in buffer-index order makes getRegister(R) == that buffer.
    void addRegister( MatrixBaseT<T> * matrix ) {
      registers->append( matrix );
    }

    MatrixBaseT<T> * getRegister( Index index ) {
      return registers->getByIndex( index );
    }

    #if GGGTX_ENABLE
    // --- Control frames + procedures --------------------------------------

    void pushFrame( ControlFrameT<T> * frame ) {
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
    // Resolve a procedure the way R addresses any register: by name, or by a
    // numeric string falling back to an index. Same shape as
    // resolveRegisterByName above, which does this for matrices.
    TProcedure * resolveProcedure( const String & ref ) {
      if ( ref.empty() ) return nullptr;
      TProcedure * reg = procedures->getByName( ref );
      if ( !reg ) {
        bool numeric = true;
        for ( char c : ref ) if ( c < '0' || c > '9' ) { numeric = false; break; }
        if ( numeric ) reg = procedures->getByIndex( std::stoi( ref ) );
      }
      return reg;
    }

    TProcedure * getProcedure( const String & name, bool create ) {
      TProcedure * reg = procedures->getByName( name );
      if ( !reg && create ) {
        reg = new TProcedure();
        reg->name = name;
        procedures->append( reg );
      }
      return reg;
    }

    // --- Async procedures ------------------------------------------------
    // The language has bounded T9 V iteration but no unbounded loop construct.
    // Open-ended repetition comes from exporting a procedure (T12) and letting
    // the HOST call poll() -- on embedded that is
    // the difference between a runaway program costing ticks the host can stop
    // granting, and one that spins inside the parser until reset.

    // Schedule (or reschedule) a procedure. count 0 cancels; count < 0 runs it
    // indefinitely. Re-exporting a name replaces its schedule, mirroring T10's
    // silent redefine.
    bool scheduleProcedure( const String & name, TProcedure * body, unsigned long interval, long count ) {
      cancelProcedure( name );
      if ( count == 0 ) return true;              // G0 is a cancel, not a schedule
      if ( limits.maxAsync && (Int) schedule.size() >= limits.maxAsync ) {
        outputFail( (Int) GGGFail::QueueOverflow );
        return false;
      }
      AsyncProcedure entry;
      entry.name = name;
      entry.body = body;
      entry.interval = interval;
      entry.remaining = count;
      schedule.push_back( entry );
      return true;
    }

    void cancelProcedure( const String & name ) {
      for ( size_t i = 0; i < schedule.size(); ) {
        if ( schedule[i].name == name ) schedule.erase( schedule.begin() + i );
        else i++;
      }
    }

    // Fire every procedure whose interval has elapsed and drain their bodies.
    // Each fires AT MOST ONCE per poll: after a long gap the next deadline is
    // rebased on `now` rather than catching up, so a late host cannot trigger a
    // burst of queued bodies. Returns how many fired.
    Index poll( unsigned long now ) {
      Index fired = 0;
      // Iterate over a copy of the names: a body may reschedule or cancel.
      std::vector<String> names;
      for ( const auto & entry : schedule ) names.push_back( entry.name );

      for ( const auto & name : names ) {
        AsyncProcedure * entry = nullptr;
        for ( auto & candidate : schedule ) {
          if ( candidate.name == name ) { entry = &candidate; break; }
        }
        if ( !entry ) continue;

        if ( !entry->started ) {
          // First sight: the schedule starts from the host's clock.
          entry->started = true;
          entry->nextDue = now + entry->interval;
          if ( entry->interval > 0 ) continue;
        }
        if ( now < entry->nextDue ) continue;

        TProcedure * body = entry->body;
        if ( !body ) { cancelProcedure( name ); continue; }

        entry->nextDue = now + entry->interval;
        const bool done = ( entry->remaining > 0 && --entry->remaining <= 0 );
        std::vector<String> lines = body->lines;
        if ( done ) cancelProcedure( name );

        enqueueLines( lines );
        drainPending();
        fired++;
      }
      return fired;
    }

    // Queue procedure source lines to run after the current line. Inserting at
    // the front keeps nested calls (a body that runs another procedure) in the
    // right order, mirroring the TS splice-after-current. Bounded by maxQueue.
    void enqueueLines( const std::vector<String> & lines ) {
      if ( limits.maxQueue && (Int)( pending.size() + lines.size() ) > limits.maxQueue ) {
        outputFail( (Int) GGGFail::QueueOverflow );
        return;
      }
      std::vector<PendingItem> items;
      for ( const String & l : lines ) items.push_back( { false, l, {} } );
      pending.insert( pending.begin(), items.begin(), items.end() );
    }

    // Run a captured body once per value, writing each value into the iteration
    // register (callback) immediately before its body copy so the body reads the
    // current value via a reference ($name / $index). P selects the flat scalar
    // offset within the register. Bounded by maxQueue.
    void enqueueLoop( const std::vector<Number> & values, const std::vector<String> & body,
                      bool hasReg, bool regByName, const String & regName, Index regIndex,
                      Index regOffset = 0 ) {
      std::vector<PendingItem> items;
      for ( Number v : values ) {
        if ( hasReg ) {
          items.push_back( { true, "", [this, v, regByName, regName, regIndex, regOffset]() {
            this->setIterRegister( regByName, regName, regIndex, v, regOffset );
          } } );
        }
        for ( const String & l : body ) items.push_back( { false, l, {} } );
      }
      if ( limits.maxQueue && (Int)( pending.size() + items.size() ) > limits.maxQueue ) {
        outputFail( (Int) GGGFail::LoopOverflow );
        return;
      }
      pending.insert( pending.begin(), items.begin(), items.end() );
    }

    // Write a scalar at a flat offset in the iteration register, addressable by
    // name or index. An on-demand register is sized through that offset.
    void setIterRegister( bool byName, const String & name, Index index, Number value,
                          Index offset = 0 ) {
      MatrixBaseT<T> * reg = byName ? registers->getByName( name ) : registers->getByIndex( index );
      if ( !reg ) {
        const Index size =
          offset >= 0 && offset < std::numeric_limits<Index>::max()
          ? offset + 1
          : 1;
        auto * m = new Matrix<Number, false, T>( { size } );
        m->allocate();
        if ( byName ) m->name = name;
        addRegister( m );
        reg = m;
      }
      reg->writeScalarFloat( value, offset );
    }

    // Drain queued procedure/loop items by feeding lines back through the parser
    // and running callbacks. The re-entrancy guard lets a nested enqueue (from a
    // body line) push onto the front while this outer loop keeps draining in order.
    void drainPending() {
      if ( draining ) return;
      draining = true;
      // Bound the TOTAL work of one drain, not just the instantaneous queue
      // depth. Items are popped as they run, so pending.size() stays small and
      // the enqueueLines guard never trips on self-recursion -- a procedure that
      // runs itself would spin here forever, which on embedded means until
      // reset. (The TS queue accumulates instead, so its guard catches this.)
      Index processed = 0;
      while ( !pending.empty() ) {
        if ( limits.maxQueue && ++processed > limits.maxQueue ) {
          pending.clear();
          outputFail( (Int) GGGFail::QueueOverflow );
          break;
        }
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
    #else
    // Keep the host polling surface stable when flow control is compiled out.
    Index poll( unsigned long ) { return 0; }
    #endif

    // All command output funnels through write(). Override it to redirect
    // output -- e.g. to a buffer for conformance tests, or to Serial on an
    // embedded target. The fallback uses byte I/O rather than iostreams so a
    // fixed-only firmware does not link the floating-point locale machinery.
    virtual void write( const String &str ) {
      std::fwrite( str.data(), 1, str.size(), stdout );
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

    // Render the O<id> head: the id via the unitary encoding (1->K, 0->Z, -1->N,
    // else the integer), so the default id 1 reads OK.
    void outputOkayValue( Int value ) {
      if ( value == 1 ) {
        output( GGG::EncodedOne );
      } else if ( value == 0 ) {
        output( EncodedZero );
      } else if ( value == -1 ) {
        output( EncodedMinusOne );
      } else {
        outputInteger( value );
      }
    }

    // Success return: the O<id> terminator (default id 1 -> OK).
    void outputOK() {
      output( GGG::Okay );
      outputOkayValue( requestId );
      output( GGG::End );
    }

    // Failure return: the same O<id> terminator plus an F<code> arg (and optional
    // comment). The presence of the F arg -- not the id -- is what signals failure.
    void outputFail( Int code, const char* comment = nullptr ) {
      output( GGG::Okay );
      outputOkayValue( requestId );
      output( GGG::EndArgument );
      output( GGG::Failure );
      outputInteger( code );
      if ( comment && comment[0] ) {
        output( String( "; " ) );
        output( String( comment ) );
      }
      output( GGG::End );
    }
  };
  using Machine = MachineT<>;

}; // namespace ggg
