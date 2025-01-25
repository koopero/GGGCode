#include "./Normal.h"
#include "./Matrix.h"
#include <cstdio>

typedef NormalizedNumber<uint8_t, 255> Norm8;

float testNumber() {
    NormalizedNumber<int16_t, 1000> a(0.3);
    NormalizedNumber<uint8_t, 200> b(0.5);


    MatrixStatic<Norm8, false> mat1({2, 2});
    mat1.allocate();

    mat1.writeNumber({1, 0}, 0.5);


    // a += b;
    // a -= 0.25;

    a /= b;

    NormalizedNumber<int16_t, 1024> c = a + b;

    std::printf( "%f %i\n", mat1.readNumber(1), a.getRaw() );
    return float(a);
}