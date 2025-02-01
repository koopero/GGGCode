#pragma once
#include "./autogen.h"
#include "./Types.h"

namespace ggg {
  class CompoundAxis {
  public:
    enum stage {
      Start,
      End,
      Step,
      Done,
    } stage = Start;

    Index count;
    Number multiplier;
    Number start;
    Number end;
    Number step;
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

    void ingest( Number value, Char code ) {
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
}; // namespace ggg