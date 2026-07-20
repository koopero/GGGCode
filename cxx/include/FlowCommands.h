#pragma once
#include "./Machine.h"

//
// Flow control: procedures via the command gate (mirrors ts/gggtx/gggtxCommands.ts).
//
//   T10 L"name"   define a procedure: open a capture frame
//   ...           following lines are stored as raw source until the matching T0
//   T0            end block: commit the body, pop the frame (T0 itself not saved)
//   T11 L"name"   run a procedure: re-enqueue its source lines
//
// The capture frame carries a depth counter so a nested T10/T0 pair is captured
// as text rather than terminating the outer definition.
//

namespace ggg {

  // Command names the capture machinery recognises. Kept here next to the
  // commands; numeric suffixes match the TS gggtxCodes (T0 / T9 / T10 / T11).
  constexpr const char* FlowBlockEnd      = "T0";
  constexpr const char* FlowConditional   = "T9";
  constexpr const char* FlowProcedureInit = "T10";

  // Shared capture frame: buffers every command's raw source into `body`,
  // tracking nested block depth so an inner T0 does not close the outer frame.
  // At the matching T0 (depth 0) it runs onClose() and pops. Mirrors the TS
  // captureGate helper in gggtxCommands.ts.
  class CaptureFrame : public ControlFrame {
  public:
    int depth = 0;
    std::vector<String> body;

    virtual void onClose( Machine & ) {}

    CommandDecision beforeCommand( Machine & m, const CommandView & view ) override {
      if ( view.command == FlowBlockEnd ) {
        if ( depth == 0 ) {
          onClose( m );              // read members before popFrame deletes this
          m.popFrame();
          return CommandDecision::Skip;
        }
        depth--;
        return CommandDecision::Capture;
      }
      if ( view.command == FlowProcedureInit || view.command == FlowConditional ) {
        depth++;                     // nested opener: capture its matching T0 too
      }
      return CommandDecision::Capture;
    }

    void captureLine( const String & source ) override {
      body.push_back( source );
    }
  };

  // T10 body: commit the captured source into the procedure register on close.
  class ProcedureCaptureFrame : public CaptureFrame {
  public:
    TProcedure * reg;
    ProcedureCaptureFrame( TProcedure * _reg ) : reg( _reg ) {}
    void onClose( Machine & ) override { reg->lines = body; }
  };

  // T9 body. Conditional mode: enqueue the captured source once iff the
  // condition held. Iteration mode: enqueue the body once per value, writing
  // each into the iteration register first.
  class ConditionalCaptureFrame : public CaptureFrame {
  public:
    bool iter = false;
    bool cond = false;
    std::vector<NumberType> values;
    bool hasReg = false;
    bool regByName = false;
    String regName;
    Index regIndex = 0;
    void onClose( Machine & m ) override {
      if ( iter ) m.enqueueLoop( values, body, hasReg, regByName, regName, regIndex );
      else if ( cond ) m.enqueueLines( body );
    }
  };

  // T10: define a procedure; opens a capture frame.
  class ProcedureInit : public CommandType {
  public:
    String procName;
    ProcedureInit() {
      name = FlowProcedureInit;
      description = "Define a procedure; capture following lines until T0";
      addArg( GGG::Alias, "procedure name", "(s)" );
    }
    void hookCommand() override { procName.clear(); }
    void hookString() override { if ( code == GGG::Alias ) procName = string; }
    void hookFinish() override {
      TProcedure * reg = machine->getProcedure( procName, true );
      reg->lines.clear();            // redefine overwrites silently
      machine->pushFrame( new ProcedureCaptureFrame( reg ) );
    }
  };

  // T0: end of block. A no-op when dispatched (the gate handles it inside a
  // capture frame); registered so a stray T0 and the D1 catalog stay clean.
  class BlockEnd : public CommandType {
  public:
    BlockEnd() {
      name = FlowBlockEnd;
      description = "End of block";
    }
  };

  // T9: the block combinator. With V it iterates the body once per value
  // (writing each into the R register so the body reads it as $name/$index);
  // otherwise it is a one-shot conditional (A = all truthy, Y = any). The body
  // is always captured first (so nested blocks compose).
  class Conditional : public CommandType {
  public:
    bool hasA, hasY, allTruthy, anyTruthy;
    std::vector<NumberType> iterValues;
    bool hasReg, regByName;
    String regName;
    Index regIndex;
    Conditional() {
      name = FlowConditional;
      description = "Block combinator: V iterates, A/O run once if a condition holds";
      addArg( 'A', "run if all values are truthy", "(n+)" );
      addArg( 'Y', "run if any value is truthy", "(n+)" );
      addArg( GGG::Value, "iterate the body once per value", "(n+)" );
      addArg( GGG::Register, "iteration register (name or index)", "" );
    }
    void hookCommand() override {
      hasA = false; hasY = false; allTruthy = true; anyTruthy = false;
      iterValues.clear(); hasReg = false; regByName = false; regName.clear(); regIndex = 0;
    }
    void hookNumber() override {
      bool truthy = number != 0;
      if ( code == 'A' ) { hasA = true; allTruthy = allTruthy && truthy; }
      else if ( code == 'Y' ) { hasY = true; anyTruthy = anyTruthy || truthy; }
      else if ( code == GGG::Value ) { iterValues.push_back( number ); }
      else if ( code == GGG::Register ) { hasReg = true; regByName = false; regIndex = (Index) number; }
    }
    void hookString() override {
      if ( code == GGG::Register ) { hasReg = true; regByName = true; regName = string; }
    }
    void hookFinish() override {
      auto * frame = new ConditionalCaptureFrame();
      if ( !iterValues.empty() ) {
        frame->iter = true;
        frame->values = iterValues;
        frame->hasReg = hasReg;
        frame->regByName = regByName;
        frame->regName = regName;
        frame->regIndex = regIndex;
      } else {
        bool cond = true;
        if ( hasA ) cond = cond && allTruthy;
        if ( hasY ) cond = cond && anyTruthy;
        if ( !hasA && !hasY ) cond = false;    // no condition -> skip
        frame->cond = cond;
      }
      machine->pushFrame( frame );
    }
  };

  // T11: run a procedure by name; re-enqueues its captured source lines.
  class ProcedureRun : public CommandType {
  public:
    String procName;
    ProcedureRun() {
      name = "T11";
      description = "Run a procedure by name";
      addArg( GGG::Alias, "procedure name", "(s)" );
    }
    void hookCommand() override { procName.clear(); }
    void hookString() override { if ( code == GGG::Alias ) procName = string; }
    void hookFinish() override {
      TProcedure * reg = machine->getProcedure( procName, false );
      if ( reg ) machine->enqueueLines( reg->lines );
      else machine->outputFail( (Int) GGGFail::ProcedureNotFound );
    }
  };

}
