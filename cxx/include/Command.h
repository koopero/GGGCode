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

  class CommandType : virtual public CommandState {
  public:
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