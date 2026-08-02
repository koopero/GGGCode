#pragma once
#include "./Types.h"
#include "./List.h"
#include "./gen/EnumTypes.h"

namespace ggg {
  template <class T> class MachineT;

  template <class T = DefaultTraits>
  class CommandStateT : virtual public ListItem {
  public:
    using Number = typename T::Number;

    MachineT<T> *machine;
    Char code;
    String string;
    Number number;
    Int okay;
  };
  using CommandState = CommandStateT<>;

  #if GGGDX_ENABLE
  // Self-documentation metadata (mirrors the TS CommandArgDescribed schema in
  // ts/ggg/Language.ts). Descriptions/formats are compile-time literals, so they
  // live in flash as const char*; the small arg list is built once in the
  // command's constructor. The D1/D4 description verbs (DocCommands.h) read
  // these to stream a catalog back to clients.
  struct CommandArgOption { const char* name; const char* description; };
  struct CommandArg {
    Char code;
    const char* description;
    const char* format;
    ArgumentKind kind;
    Int domain;
    bool required;
    std::vector<CommandArgOption> options;
  };
  struct CommandResponse {
    String command;
    const char* description;
  };
  struct CommandExample {
    const char* source;
    const char* description;
  };
  #endif

  template <class T = DefaultTraits>
  class CommandTypeT : virtual public CommandStateT<T> {
  public:
    #if GGGDX_ENABLE
    const char* description = "";
    std::vector<CommandArg> args;
    std::vector<CommandResponse> responds;
    // Command-relative source snippets. D1/D4 emit these as D-45 records.
    std::vector<CommandExample> examples;
    // Non-executable result-record schemas emitted by this command. D2 owns
    // D-20/D-21, D4 owns D-40/D-41/D-42/D-45, and D5 owns D-50/D-51. They use
    // this exact metadata shape so the protocol can describe its descriptions.
    std::vector<CommandTypeT<T>*> records;
    // Domains required by result records even if no executable arg names them.
    std::vector<Int> domains;

    virtual ~CommandTypeT() {
      for ( auto *record : records ) delete record;
    }

    void describe( const char* value ) {
      description = value;
    }

    void addArg( Char code, const char* desc, const char* format = "",
        ArgumentKind kind = ArgumentKind::Data, Int domain = -1, bool required = false ) {
      args.push_back({ code, desc, format, kind, domain, required, {} });
    }

    void addArgOption( Char code, const char* name, const char* desc ) {
      for ( auto &a : args ) {
        if ( a.code == code ) { a.options.push_back({ name, desc }); return; }
      }
    }

    void addDomain( EnumGroupIndex domain ) {
      domains.push_back( (Int) domain );
    }

    void addRecord( CommandTypeT<T> *record ) {
      records.push_back( record );
    }

    void addResponse( const String &command, const char* desc = "" ) {
      responds.push_back({ command, desc });
    }

    void addExample( const char* source, const char* desc = "" ) {
      examples.push_back({ source, desc });
    }
    #else
    virtual ~CommandTypeT() = default;

    // Keep one source-level command declaration API while compiling every
    // description literal and metadata allocation away in non-gggdx builds.
    inline void describe( const char* ) {}
    inline void addArg( Char, const char*, const char* = "",
      ArgumentKind = ArgumentKind::Data, Int = -1, bool = false ) {}
    inline void addArgOption( Char, const char*, const char* ) {}
    inline void addDomain( EnumGroupIndex ) {}
    inline void addRecord( CommandTypeT<T>* ) {}
    inline void addResponse( const String&, const char* = "" ) {}
    inline void addExample( const char*, const char* = "" ) {}
    #endif

    virtual void hookBefore() { }
    virtual void hookCommand() { }
    virtual void hookCode() { }
    virtual void hookString() { }
    virtual void hookNumber() { }
    virtual void hookArg() { }
    virtual void hookFinish() {  }
  };
  using CommandType = CommandTypeT<>;



  inline Char CasedString( Char _char ) {
    return std::toupper( _char );
  }

  inline bool isNumberStart( Char _char ) {
    return ( _char >= '0' && _char <= '9' ) || _char == '.' || _char == '+' || _char == '-';
  }
}; // namespace ggg
