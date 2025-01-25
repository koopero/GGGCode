#pragma once

#include "./Types.h"
#include "./autogen.h"

struct gggLimits {
  gggIndex maxAxes = 4;
  gggIndex maxBuffer = 1024;
  gggIndex maxOperations = 1024;
  gggIndex maxRegisters = 256;
  gggIndex maxRegisterSize = 0x10000;
};

//
// Base class for items that can be stored in gggList
class gggListItem {
public:
  gggListItem() {}

  gggString name; // The name of the item
  int index; // The index of the item in the list

  gggListItem(const gggString& name, int index) : name(name), index(index) {}

  // Virtual destructor to allow subclass destruction correctly
  virtual ~gggListItem() {}
};

// gggList manages items that are subclasses of gggListItem
template<typename T>
class gggList {
private:
  std::unordered_map<gggString, T*> itemsByName;
  std::vector<T*> items;

public:
  // Destructor to clean up items
  ~gggList() {
    for (auto item : items) {
      delete item;
    }
  }

  // Append an item to the list. T must be a subclass of gggListItem.
  void append(T* item) {
    item->index = items.size(); // Set the index of the item
    items.push_back(item);
    itemsByName[item->name] = item;
  }

  // Get an item by name
  T* getByName(const gggString& name) {
    if (itemsByName.find(name) != itemsByName.end()) {
      return itemsByName[name];
    }
    return nullptr; // Return null if not found
  }

  // Get an item by index
  T* getByIndex(int index) {
    if (index >= 0 && index < items.size()) {
      return items[index];
    }
    return nullptr; // Return null if out of bounds
  }
};
//


class gggMachineRegister {

};

class gggMachine;

class gggCommandState : virtual public gggListItem {
public:
  gggMachine *machine;
  gggChar code;
  gggString string;
  gggNumber number;
  gggInt okay;
};

class gggCommand : virtual public gggCommandState {
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

class gggCompoundAxis {
public:
  enum stage {
    Start,
    End,
    Step,
    Done,
  } stage = Start;

  gggIndex count;
  gggNumber multiplier;
  gggNumber start;
  gggNumber end;
  gggNumber step;
  bool inclusive;
  bool divide;

  void reset() {
    stage = Start;
    multiplier = 0.;
    count = 1;
    start = 0.;
    end = 0.;
    step = 1.;
    inclusive = true;
  }

  void ingest( gggNumber value, gggChar code ) {
    if ( code == Multiplier ) {
      multiplier = value;
    } else if ( stage == Start ) {
      start = value;
      end = value;

      if ( code == Count ) {
        divide = true;
      } else if ( code == Range ) {
        inclusive = true;
      } else {
        inclusive = false;
      }
      stage = End;
    } else if ( stage == End ) {
      if ( divide ) {
        count = floor( value );
        step = 0;
        stage = Done;
        return;
      }
      if ( code == Count ) {
        divide = true;
      }

      end = value;
      step = end < start ? -1 : 1;
      count = floor( abs( end - start ) ) + ( inclusive ? 1 : 0  );
      stage = Step;
    } else if ( stage == Step ) {
      if ( divide ) {
        count = floor( value );
        step = ( end - start ) / ( count - ( inclusive ? 1 : 0 ) );
      } else {
        step = value;
        count = ( end - start ) / step + ( inclusive ? 1 : 0 );
      }
      step = value;
      stage = Done;
    }
  }
};

struct gggMachineState {
  GGG lineMode = GGG::Command;
  GGG expressionMode = GGG::Code;
  GGG dataMode;

  enum {
    Start,
    End,
    Step,
  } listMode;

  bool skipData = false;
  bool skipLine = false;

  gggInt index = 0;
  gggInt col = 0;
  gggInt row = 0;

  gggChar code;
  gggNumber value;
  gggString string;
  gggString line;
  gggString comment;
  gggString argBuffer;

  std::vector<gggNumber> numbers;
  std::vector<gggChar> symbols;

  gggInt compoundIndex = 0;
  std::vector<gggCompoundAxis> compoundAxes;

  unsigned long hexAccum;
  gggInt hexDigit;
  gggInt hexDigitCount;
  bool hexNormalize;
};


gggChar gggCasedString( gggChar _char ) {
  return std::toupper( _char );
}

bool isNumberStart( gggChar _char ) {
  return ( _char >= '0' && _char <= '9' ) || _char == '.' || _char == '+' || _char == '-';
}


#include "./gggMachine.h"