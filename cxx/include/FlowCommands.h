#pragma once
#include "./Config.h"
#if GGGTX_ENABLE
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
  constexpr const char* FlowAsyncExport   = "T12";

  // Shared capture frame: buffers every command's raw source into `body`,
  // tracking nested block depth so an inner T0 does not close the outer frame.
  // At the matching T0 (depth 0) it runs onClose() and pops. Mirrors the TS
  // captureGate helper in gggtxCommands.ts.
  template <class T = DefaultTraits>
  class CaptureFrameT : public ControlFrameT<T> {
  public:
    int depth = 0;
    std::vector<String> body;

    virtual void onClose( MachineT<T> & ) {}

    CommandDecision beforeCommand( MachineT<T> & m, const CommandViewT<T> & view ) override {
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
  using CaptureFrame = CaptureFrameT<>;

  // T10 body: commit the captured source into the procedure register on close.
  template <class T = DefaultTraits>
  class ProcedureCaptureFrameT : public CaptureFrameT<T> {
    using CaptureFrameT<T>::body;
  public:
    TProcedure * reg;
    ProcedureCaptureFrameT( TProcedure * _reg ) : reg( _reg ) {}
    void onClose( MachineT<T> & ) override { reg->lines = body; }
  };
  using ProcedureCaptureFrame = ProcedureCaptureFrameT<>;

  // T9 body. Conditional mode: enqueue the captured source once iff the
  // condition held. Iteration mode: enqueue the body once per value, writing
  // each into the selected offset of the iteration register first.
  template <class T = DefaultTraits>
  class ConditionalCaptureFrameT : public CaptureFrameT<T> {
    using CaptureFrameT<T>::body;
  public:
    bool iter = false;
    bool cond = false;
    std::vector<typename T::Number> values;
    bool hasReg = false;
    bool regByName = false;
    String regName;
    Index regIndex = 0;
    Index regOffset = 0;
    void onClose( MachineT<T> & m ) override {
      if ( iter )
        m.enqueueLoop( values, body, hasReg, regByName, regName, regIndex, regOffset );
      else if ( cond ) m.enqueueLines( body );
    }
  };
  using ConditionalCaptureFrame = ConditionalCaptureFrameT<>;

  // T10: define a procedure; opens a capture frame.
  template <class T = DefaultTraits>
  class ProcedureInitT : public CommandTypeT<T> {
  public:
    using Base = CommandTypeT<T>;
    using Base::machine; using Base::code; using Base::number;
    using Base::string;  using Base::okay;  using Base::name;
    using Base::describe; using Base::addArg;
    using Number = typename T::Number;

    String procRef, procName;
    ProcedureInitT() {
      name = FlowProcedureInit;
      describe( "Define a procedure; capture following lines until T0" );
      addArg( GGG::Register, "procedure to (re)define (index or name)", "",
        ArgumentKind::Reference, (Int) EnumGroupIndex::ProcedureRegister );
      addArg( GGG::Alias, "name to give the procedure", "", ArgumentKind::String );
    }
    void hookCommand() override { procRef.clear(); procName.clear(); }
    void hookString() override {
      if ( code == GGG::Register ) procRef = string;      // R selects
      else if ( code == GGG::Alias ) procName = string;   // L only names
    }
    void hookNumber() override {
      if ( code == GGG::Register ) procRef = std::to_string( (long) number );
    }
    void hookFinish() override {
      // Select with R if given, else by the name being assigned, so a bare
      // T10 L"p" still redefines "p" in place rather than stacking duplicates.
      TProcedure * reg = machine->resolveProcedure( procRef );
      if ( !reg ) reg = machine->getProcedure( procName, true );
      reg->lines.clear();            // redefine overwrites silently
      if ( !procName.empty() && reg->name != procName ) {
        machine->procedures->setItemName( reg, procName );
      }
      machine->pushFrame( new ProcedureCaptureFrameT<T>( reg ) );
    }
  };
  using ProcedureInit = ProcedureInitT<>;

  // T0: end of block. A no-op when dispatched (the gate handles it inside a
  // capture frame); registered so a stray T0 and the D1 catalog stay clean.
  template <class T = DefaultTraits>
  class BlockEndT : public CommandTypeT<T> {
  public:
    using Base = CommandTypeT<T>;
    using Base::name; using Base::describe;

    BlockEndT() {
      name = FlowBlockEnd;
      describe( "End of block" );
    }
  };
  using BlockEnd = BlockEndT<>;

  // T9: the block combinator. With V it iterates the body once per value
  // (writing each into offset P of the R register so the body reads it as
  // $name/$index); otherwise it is a one-shot conditional (A = all truthy,
  // Y = any). The body is always captured first (so nested blocks compose).
  template <class T = DefaultTraits>
  class ConditionalT : public CommandTypeT<T> {
  public:
    using Base = CommandTypeT<T>;
    using Base::machine; using Base::code; using Base::number;
    using Base::string;  using Base::okay;  using Base::name;
    using Base::describe; using Base::addArg;
    using Number = typename T::Number;

    bool hasA, hasY, allTruthy, anyTruthy;
    std::vector<Number> iterValues;
    bool hasReg, regByName;
    String regName;
    Index regIndex;
    Index regOffset;
    ConditionalT() {
      name = FlowConditional;
      describe( "Block combinator: V iterates, A/O run once if a condition holds" );
      addArg( 'A', "run if all values are truthy", "comma-list:number;one-or-more", ArgumentKind::Number );
      addArg( 'Y', "run if any value is truthy", "comma-list:number;one-or-more", ArgumentKind::Number );
      addArg( GGG::Value, "iterate the body once per value", "comma-list:number;one-or-more", ArgumentKind::Number );
      addArg( GGG::Register, "iteration matrix register (name or index)", "",
        ArgumentKind::Reference, (Int) EnumGroupIndex::MatrixRegister );
      addArg( GGG::Offset, "scalar offset in the iteration register", "", ArgumentKind::Number );
    }
    void hookCommand() override {
      hasA = false; hasY = false; allTruthy = true; anyTruthy = false;
      iterValues.clear(); hasReg = false; regByName = false; regName.clear();
      regIndex = 0; regOffset = 0;
    }
    void hookNumber() override {
      bool truthy = number != 0;
      if ( code == 'A' ) { hasA = true; allTruthy = allTruthy && truthy; }
      else if ( code == 'Y' ) { hasY = true; anyTruthy = anyTruthy || truthy; }
      else if ( code == GGG::Value ) { iterValues.push_back( number ); }
      else if ( code == GGG::Register ) { hasReg = true; regByName = false; regIndex = (Index) number; }
      else if ( code == GGG::Offset ) { regOffset = (Index) number; }
    }
    void hookString() override {
      if ( code == GGG::Register ) { hasReg = true; regByName = true; regName = string; }
    }
    void hookFinish() override {
      auto * frame = new ConditionalCaptureFrameT<T>();
      if ( !iterValues.empty() ) {
        frame->iter = true;
        frame->values = iterValues;
        frame->hasReg = hasReg;
        frame->regByName = regByName;
        frame->regName = regName;
        frame->regIndex = regIndex;
        frame->regOffset = regOffset;
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
  using Conditional = ConditionalT<>;

  // T11: run a procedure by name; re-enqueues its captured source lines.
  // T12: export a procedure as asynchronous. The body is not run here -- it is
  // handed to the machine's schedule and the HOST runs it by calling poll().
  // That is how the language gets unbounded repetition without owning a loop.
  template <class T = DefaultTraits>
  class AsyncExportT : public CommandTypeT<T> {
  public:
    using Base = CommandTypeT<T>;
    using Base::machine; using Base::code; using Base::number;
    using Base::string;  using Base::okay;  using Base::name;
    using Base::describe; using Base::addArg;
    using Number = typename T::Number;

    String procRef;
    Number interval;
    long count;
    AsyncExportT() {
      name = "T12";
      describe( "Export a procedure to run asynchronously on the host's schedule" );
      addArg( GGG::Register, "procedure to export (index or name)", "",
        ArgumentKind::Reference, (Int) EnumGroupIndex::ProcedureRegister );
      addArg( GGG::Size, "interval in milliseconds", "", ArgumentKind::Number );
      addArg( GGG::Repeat, "run count; omit for unbounded, 0 cancels", "", ArgumentKind::Number );
    }
    void hookCommand() override { procRef.clear(); interval = 0; count = -1; }
    void hookString() override { if ( code == GGG::Register ) procRef = string; }
    void hookNumber() override {
      if ( code == GGG::Register ) procRef = std::to_string( (long) number );
      else if ( code == GGG::Size ) interval = number;
      else if ( code == GGG::Repeat ) count = (long) number;
    }
    void hookFinish() override {
      TProcedure * body = machine->resolveProcedure( procRef );
      if ( !body ) { machine->outputFail( (Int) GGGFail::ProcedureNotFound ); return; }
      // Key the schedule on the register's own identity, so cancel/reschedule
      // agree regardless of whether R addressed it by index or by name.
      machine->scheduleProcedure( body->name, body, (unsigned long) interval, count );
    }
  };
  using AsyncExport = AsyncExportT<>;

  template <class T = DefaultTraits>
  class ProcedureRunT : public CommandTypeT<T> {
  public:
    using Base = CommandTypeT<T>;
    using Base::machine; using Base::code; using Base::number;
    using Base::string;  using Base::okay;  using Base::name;
    using Base::describe; using Base::addArg;
    using Number = typename T::Number;

    String procRef;
    ProcedureRunT() {
      name = "T11";
      describe( "Run a procedure" );
      addArg( GGG::Register, "procedure to run (index or name)", "",
        ArgumentKind::Reference, (Int) EnumGroupIndex::ProcedureRegister );
    }
    void hookCommand() override { procRef.clear(); }
    void hookString() override { if ( code == GGG::Register ) procRef = string; }
    void hookNumber() override {
      if ( code == GGG::Register ) procRef = std::to_string( (long) number );
    }
    void hookFinish() override {
      TProcedure * reg = machine->resolveProcedure( procRef );
      if ( reg ) machine->enqueueLines( reg->lines );
      else machine->outputFail( (Int) GGGFail::ProcedureNotFound );
    }
  };
  using ProcedureRun = ProcedureRunT<>;

}
#endif
