#include "../src/Normal.h"
#include "../src/Print.h"
#include "../src/Matrix.h"
#include <cstdio>
#include <assert.h>

typedef NormalizedNumber<uint8_t, 255> Norm8;
typedef NormalizedNumber<int8_t, 16> SNorm8;


float testNumber() {
    NormalizedNumber<int16_t, 1000> a(0.3);

    bool matches = (a == 0.3);
    // std::assert( (a == 0.3) );
    NormalizedNumber<uint8_t, 200> b(0.5);


    MatrixStatic<Norm8, false> mat1({2, 2});
    mat1.allocate();

    mat1.writeNumber(ggg::DimType({0, 0}), 0.5);


    // a += b;
    // a -= 0.25;

    a /= b;

    NormalizedNumber<int16_t, 1024> c = a + b;

    Norm8 d = mat1.readNumber(DimType({0, 0}));

    std::printf( "%f %i\n", float(d), d.getRaw() );
    return float(a);
}