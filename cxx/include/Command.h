#pragma once
#include "./Types.h"
#include "./List.h"

namespace ggg {
  class Machine;

  class CommandState : virtual public ListItem {
  public:
    Machine *machine;
    Char code;
    String string;
    NumberType number;
    Int okay;
  };

  // Self-documentation metadata (mirrors the TS CommandArgDescribed schema in
  // ts/ggg/Language.ts). Descriptions/formats are compile-time literals, so they
  // live in flash as const char*; the small arg list is built once in the
  // command's constructor. The D1 "list commands" verb (DocCommands.h) reads
  // these to stream a catalog back to clients.
  struct CommandArgOption { const char* name; const char* description; };
  struct CommandArg {
    Char code;
    const char* description;
    const char* format;
    std::vector<CommandArgOption> options;
  };

  class CommandType : virtual public CommandState {
  public:
    const char* description = "";
    std::vector<CommandArg> args;

    void addArg( Char code, const char* desc, const char* format = "" ) {
      args.push_back({ code, desc, format, {} });
    }

    void addArgOption( Char code, const char* name, const char* desc ) {
      for ( auto &a : args ) {
        if ( a.code == code ) { a.options.push_back({ name, desc }); return; }
      }
    }

    virtual void hookBefore() { }
    virtual void hookCommand() { }
    virtual void hookCode() { }
    virtual void hookString() { }
    virtual void hookNumber() { }
    virtual void hookArg() { }
    virtual void hookFinish() {  }

    void hookNumberOkay() {
      if ( code == GGG::Okay ) {
        okay = number;
      }
    }
  };



  inline Char CasedString( Char _char ) {
    return std::toupper( _char );
  }

  inline bool isNumberStart( Char _char ) {
    return ( _char >= '0' && _char <= '9' ) || _char == '.' || _char == '+' || _char == '-';
  }
}; // namespace ggg