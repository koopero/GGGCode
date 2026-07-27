#pragma once
#include "./Command.h"
#include "./Machine.h"
#include "./Matrix.h"
#include "./Format.h"
#include "./Operators.h"
#include "./gen/CommandConvention.h"

namespace ggg {

  // Matrix command layer, mirroring ts/ggggx. Command names are GXCode('G') +
  // CommandConvention number (Write=20, Read=10). Data moves over the wire as
  // replayable writes: a G10 Read response IS a G20 Write the client can apply.
  // Arg codes: R register, P offset, S size/count, V data values (E encoding,
  // decimal-only for now). The register is resolved from the machine's table.

  // G20 -- write scalar values into a register's matrix starting at offset P.
  template <class T = DefaultTraits>
  class MatrixWriteT : public CommandTypeT<T> {
    using Base = CommandTypeT<T>;
    using Base::machine; using Base::code; using Base::number;
    using Base::string;  using Base::okay;  using Base::name;
    using Base::description; using Base::addArg;
    using Number = typename T::Number;

    MatrixBaseT<T> * reg = nullptr;
    Index offset = 0;
    String op;                       // Q operator (default "set")
  public:
    MatrixWriteT() {
      name = "G20";
      description = "Write values into a register.";
      addArg( Register, "register index or name", "(n|s)" );
      addArg( Offset, "start offset", "(n)" );
      addArg( Operator, "write operator (set/add/mult/...)", "(s)" );
      addArg( Value, "values to write", "(n+)" );
    }

    void hookCommand() override { reg = nullptr; offset = 0; op = "set"; okay = 1; }

    void hookNumber() override {
      switch ( code ) {
        case Register: reg = machine->getRegister( (Index) number ); break;
        case Offset:   offset = (Index) number; break;
        case Value: {                // 'V' -- the values slot
          if ( !reg ) break;
          // Apply the operator: read the current cell, combine with the incoming
          // value, write back (mirrors TS OperatorApply in MatrixWrite).
          Number current = reg->readScalarFloat( offset, 0 );
          Number result;
          if ( applyOperator( op, current, number, result ) ) {
            reg->writeScalarFloat( result, offset );
          } else {
            okay = 0;                // unknown operator -> report failure
          }
          offset++;
          break;
        }
        default: break;
      }
    }

    // R is the universal register selector: numeric -> by index (hookNumber),
    // string -> by name here. L never selects; it only names (G30).
    // Q selects the write operator.
    void hookString() override {
      if ( code == Register )
        reg = machine->resolveRegisterByName( string );
      else if ( code == Operator )
        op = string;
    }

    void hookFinish() override {
      if ( okay ) machine->outputOK();
      else machine->outputFail( (Int) GGGFail::BadOperator );
    }
  };
  using MatrixWrite = MatrixWriteT<>;

  // G10 -- read a region of a register's matrix; respond with a G20 Write the
  // client can replay (R index, P start, V values...).
  template <class T = DefaultTraits>
  class MatrixReadT : public CommandTypeT<T> {
    using Base = CommandTypeT<T>;
    using Base::machine; using Base::code; using Base::number;
    using Base::string;  using Base::okay;  using Base::name;
    using Base::description; using Base::addArg;
    using Number = typename T::Number;

    MatrixBaseT<T> * reg = nullptr;
    Index offset = 0;
    Index count = -1;
  public:
    MatrixReadT() {
      name = "G10";
      description = "Read a region of a register (responds with a G20 write).";
      addArg( Register, "register index or name", "(n|s)" );
      addArg( Offset, "start offset", "(n)" );
      addArg( Size, "scalar count", "(n)" );
    }

    void hookCommand() override { reg = nullptr; offset = 0; count = -1; okay = 1; }

    void hookNumber() override {
      switch ( code ) {
        case Register: reg = machine->getRegister( (Index) number ); break;
        case Offset:   offset = (Index) number; break;
        case Size:     count = (Index) number; break;
        default: break;
      }
    }

    // R is the universal register selector: numeric -> by index (hookNumber),
    // string -> by name here. L never selects; it only names (G30).
    void hookString() override {
      if ( code == Register )
        reg = machine->resolveRegisterByName( string );
    }

    void hookFinish() override {
      if ( reg ) {
        Index total = reg->sizeScalar();
        Index start = ( offset < 0 || offset >= total ) ? 0 : offset;
        Index n = ( count < 0 ) ? ( total - start ) : count;
        if ( n > total - start ) n = total - start;

        machine->output( String( "G20 " ) );
        machine->output( (Char) Register );
        machine->outputInteger( reg->index );
        machine->output( (Char) EndArgument );
        machine->output( (Char) Offset );
        machine->outputInteger( start );
        machine->output( (Char) EndArgument );
        machine->output( (Char) Value );
        for ( Index i = 0; i < n; i++ ) {
          if ( i ) machine->output( (Char) Comma );
          machine->output( FormatNumber( reg->readScalarFloat( start + i, 0 ) ) );
        }
        machine->output( (Char) End );
      }
      if ( okay ) machine->outputOK();
      else machine->outputFail( (Int) GGGFail::BufferNotFound );
    }
  };
  using MatrixRead = MatrixReadT<>;

}; // namespace ggg
