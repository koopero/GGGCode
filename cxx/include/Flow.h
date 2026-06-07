#pragma once
#include "./Types.h"
#include "./List.h"
#include <cctype>
#include <functional>

namespace ggg {
  class Machine;

  // Decision returned by a control frame's beforeCommand() once a command is
  // formalized (its name is known). Mirrors the TS CommandDecision in
  // ts/ggg/Language.ts -- hand-written in both languages since it is behavioral,
  // not a wire constant.
  enum class CommandDecision { Run, Capture, Skip, Error };

  // Lightweight view of a just-formalized command handed to a control frame
  // before dispatch. The frame inspects the name to decide run/capture/skip.
  struct CommandView {
    String command;     // e.g. "P10", "T0"
    Char code;          // leading code letter
    NumberType number;  // numeric suffix
  };

  // A control frame sits on the machine's frame stack. Before each subsequent
  // command is dispatched, the top frame decides whether to run it, capture its
  // raw source into a body, skip it, or fail. captureLine() receives the raw
  // source of a captured line at end-of-line.
  class ControlFrame {
  public:
    virtual ~ControlFrame() {}
    virtual CommandDecision beforeCommand( Machine&, const CommandView& ) = 0;
    virtual void captureLine( const String& ) {}
  };

  // A T-extension procedure body: source lines, addressable by name/index via
  // the standard List container.
  class TProcedure : public ListItem {
  public:
    std::vector<String> lines;
  };

  // An item in the machine's pending queue: either a source line to re-feed
  // through the parser, or a callback (used to set the iteration register
  // between loop-body copies). Mirrors the TS QueueItem { line | callback }.
  struct PendingItem {
    bool isCallback = false;
    String line;
    std::function<void()> callback;
  };

  // Trim leading/trailing whitespace; matches the TS source = str.trim() used
  // when recording captured command lines.
  inline String trimSource( const String& s ) {
    size_t a = 0, b = s.size();
    while ( a < b && std::isspace( (unsigned char) s[a] ) ) a++;
    while ( b > a && std::isspace( (unsigned char) s[b-1] ) ) b--;
    return s.substr( a, b - a );
  }
}
