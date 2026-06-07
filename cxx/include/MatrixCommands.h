#pragma once
#include "./Command.h"
#include "./Machine.h"
#include "./Matrix.h"
#include "./Format.h"
#include "./gen/CommandConvention.h"

namespace ggg {

  // Matrix command layer, mirroring ts/ggggx. Command names are GXCode('G') +
  // CommandConvention number (Write=20, Read=10). Data moves over the wire as
  // replayable writes: a G10 Read response IS a G20 Write the client can apply.
  // Arg codes: R register, P offset, S size/count, V data values (E encoding,
  // decimal-only for now). The register is resolved from the machine's table.

  // G20 -- write scalar values into a register's matrix starting at offset P.
  class MatrixWrite : public CommandType {
    MatrixBase * reg = nullptr;
    Index offset = 0;
  public:
    MatrixWrite() {
      name = "G20";
      description = "Write values into a register.";
      addArg( Register, "register index or name", "(n|s)" );
      addArg( Alias, "register name", "(s)" );
      addArg( Offset, "start offset", "(n)" );
      addArg( Value, "values to write", "(n+)" );
    }

    void hookCommand() override { reg = nullptr; offset = 0; okay = 1; }

    void hookNumber() override {
      switch ( code ) {
        case Register: reg = machine->getRegister( (Index) number ); break;
        case Offset:   offset = (Index) number; break;
        case Value:                 // 'V' -- the values slot
          if ( reg ) reg->writeScalarFloat( number, offset++ );
          break;
        default: break;
      }
    }

    // R is the universal register selector: numeric -> by index (hookNumber),
    // string -> by name here. Alias (L) stays as a back-compat name selector.
    void hookString() override {
      if ( code == Register || code == Alias )
        reg = machine->resolveRegisterByName( string );
    }

    void hookFinish() override {
      machine->outputOK( okay );
    }
  };

  // G10 -- read a region of a register's matrix; respond with a G20 Write the
  // client can replay (R index, P start, V values...).
  class MatrixRead : public CommandType {
    MatrixBase * reg = nullptr;
    Index offset = 0;
    Index count = -1;
  public:
    MatrixRead() {
      name = "G10";
      description = "Read a region of a register (responds with a G20 write).";
      addArg( Register, "register index or name", "(n|s)" );
      addArg( Alias, "register name", "(s)" );
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
    // string -> by name here. Alias (L) stays as a back-compat name selector.
    void hookString() override {
      if ( code == Register || code == Alias )
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
          machine->output( FormatNumber( reg->readScalarFloat( start + i, 0. ) ) );
        }
        machine->output( (Char) End );
      }
      machine->outputOK( okay );
    }
  };

}; // namespace ggg
