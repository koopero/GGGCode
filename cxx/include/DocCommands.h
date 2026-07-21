#pragma once
#include "./Command.h"
#include "./Machine.h"

namespace ggg {

  // gggdx "list commands" verb -- a C++ port of ts/gggdx/DocCommands.ts. On D1,
  // stream the machine's command catalog back to the client as GGG comments:
  // each command's name + description, each documented argument
  // ("  <code><format> ; <desc>"), and each option ("    <name> ; <desc>"),
  // terminated with OK. This is how a GGG device self-documents over the wire.
  template <class T = DefaultTraits>
  class CommandsListT : public CommandTypeT<T> {            // 'D' + List(1) = "D1"
  public:
    using Base = CommandTypeT<T>;
    using Base::machine; using Base::code; using Base::number;
    using Base::string;  using Base::okay;  using Base::name;
    using Base::description; using Base::args; using Base::addArg;
    using Number = typename T::Number;

    CommandsListT() {
      name = "D1";
      description = "List available commands.";
    }

    void hookFinish() override {
      machine->output( String( "D-1 ; " ) + description + "\n" );   // 'D' + ListResponse(-1)
      for ( Index i = 0; ; i++ ) {
        CommandTypeT<T> *c = machine->commands->getByIndex( i );
        if ( !c ) break;
        machine->output( String( "; " ) + c->name + " : " + c->description + "\n" );
        for ( auto &a : c->args ) {
          machine->output( String( ";   " ) + a.code + a.format + " ; " + a.description + "\n" );
          for ( auto &o : a.options ) {
            machine->output( String( ";     " ) + o.name + " ; " + o.description + "\n" );
          }
        }
      }
      machine->outputOK();
    }
  };
  using CommandsList = CommandsListT<>;

}; // namespace ggg
