#include <unity.h>
#include "Normal.h"
#include "Matrix.h"

// Test functions
void test_norm_compare() {
  float OneA = 1;
  float TwoA = 2;
  NormalizedNumber<int16_t, 400, int32_t> OneB(1);
  NormalizedNumber<uint8_t, 200, int32_t> OneC(1);
  NormalizedNumber<int16_t, 400, int32_t> TwoB(2);
  NormalizedNumber<uint8_t, 200, int32_t> TwoC(2);
  
  TEST_ASSERT( OneA == OneA );
  TEST_ASSERT( OneA == OneB );
  TEST_ASSERT( OneA == OneC );
  TEST_ASSERT( OneB == OneA );
  TEST_ASSERT( OneB == OneB );
  TEST_ASSERT( OneB == OneC );
  TEST_ASSERT( OneC == OneA );
  TEST_ASSERT( OneC == OneB );
  TEST_ASSERT( OneC == OneC );

  TEST_ASSERT( OneA != TwoA );
  TEST_ASSERT( OneA != TwoB );
  TEST_ASSERT( OneA != TwoC );
  TEST_ASSERT( OneB != TwoA );
  TEST_ASSERT( OneB != TwoB );
  TEST_ASSERT( OneB != TwoC );
  TEST_ASSERT( OneC != TwoA );
  TEST_ASSERT( OneC != TwoB );
  TEST_ASSERT( OneC != TwoC );

  TEST_ASSERT( TwoA > OneA );
  TEST_ASSERT( TwoA > OneB );
  TEST_ASSERT( TwoA > OneB );
  TEST_ASSERT( TwoB > OneA );
  TEST_ASSERT( TwoB > OneB );
  TEST_ASSERT( TwoB > OneC );
  TEST_ASSERT( TwoC > OneA );
  TEST_ASSERT( TwoC > OneB );
  TEST_ASSERT( TwoC > OneC );

  TEST_ASSERT( TwoA >= OneA );
  TEST_ASSERT( TwoA >= OneB );
  TEST_ASSERT( TwoA >= OneB );
  TEST_ASSERT( TwoB >= OneA );
  TEST_ASSERT( TwoB >= OneB );
  TEST_ASSERT( TwoB >= OneC );
  TEST_ASSERT( TwoC >= OneA );
  TEST_ASSERT( TwoC >= OneB );
  TEST_ASSERT( TwoC >= OneC );
  TEST_ASSERT( OneA >= OneA );
  TEST_ASSERT( OneA >= OneB );
  TEST_ASSERT( OneA >= OneB );
  TEST_ASSERT( OneB >= OneA );
  TEST_ASSERT( OneB >= OneB );
  TEST_ASSERT( OneB >= OneC );
  TEST_ASSERT( OneC >= OneA );
  TEST_ASSERT( OneC >= OneB );
  TEST_ASSERT( OneC >= OneC );

  TEST_ASSERT( OneA < TwoA );
  TEST_ASSERT( OneA < TwoB );
  TEST_ASSERT( OneA < TwoB );
  TEST_ASSERT( OneB < TwoA );
  TEST_ASSERT( OneB < TwoB );
  TEST_ASSERT( OneB < TwoC );
  TEST_ASSERT( OneC < TwoA );
  TEST_ASSERT( OneC < TwoB );
  TEST_ASSERT( OneC < TwoC );

  TEST_ASSERT( OneA <= TwoA );
  TEST_ASSERT( OneA <= TwoB );
  TEST_ASSERT( OneA <= TwoB );
  TEST_ASSERT( OneB <= TwoA );
  TEST_ASSERT( OneB <= TwoB );
  TEST_ASSERT( OneB <= TwoC );
  TEST_ASSERT( OneC <= TwoA );
  TEST_ASSERT( OneC <= TwoB );
  TEST_ASSERT( OneC <= TwoC );
  TEST_ASSERT( OneA <= OneA );
  TEST_ASSERT( OneA <= OneB );
  TEST_ASSERT( OneA <= OneB );
  TEST_ASSERT( OneB <= OneA );
  TEST_ASSERT( OneB <= OneB );
  TEST_ASSERT( OneB <= OneC );
  TEST_ASSERT( OneC <= OneA );
  TEST_ASSERT( OneC <= OneB );
  TEST_ASSERT( OneC <= OneC );
}



// Test functions
void test_matrix_int() {
  auto mat1 = ggg::MatrixStatic<int, false>({2, 2, 2});
  mat1.allocate();
  mat1.write( { 100, 200, 300 } );
  mat1.write( 333, 2 );
  mat1.write( 444, { 1, 1 } );
  mat1.write( {5, 6, 7 }, { 0,0,1} );

  TEST_ASSERT_EQUAL_INT(8, mat1.size);
  TEST_ASSERT_EQUAL_INT(100, mat1.readNumber({0, 0}));
  TEST_ASSERT_EQUAL_INT(200, mat1.readNumber({1, 0}));
  TEST_ASSERT_EQUAL_INT(333, mat1.readNumber({0, 1}));
  TEST_ASSERT_EQUAL_INT(444, mat1.readNumber({1, 1}));
  TEST_ASSERT_EQUAL_INT(5, mat1.readNumber({0, 0, 1}));
}

void test_matrix_norm() {
  auto mat1 = ggg::MatrixStatic<NormalizedNumber<int16_t, 100, int32_t>, false>({2, 2, 2});
  mat1.allocate();
  mat1.write( { 10, 20, 30 } );
  mat1.write( 33, 2 );
  mat1.write( 44, { 1, 1 } );
  mat1.write( {0.5, 0.6, -0.7 }, { 0,0,1} );
  mat1.write( 100000, { 1,1,1 } );

  TEST_ASSERT_EQUAL_INT(8, mat1.size);
  TEST_ASSERT_EQUAL_INT(10, mat1.readNumber(0));
  TEST_ASSERT_EQUAL_INT(20, mat1.readNumber(1));
  TEST_ASSERT_EQUAL_INT(33, mat1.readNumber({0, 1}));
  TEST_ASSERT_EQUAL_INT(44, mat1.readNumber({1, 1}));
  TEST_ASSERT_EQUAL_FLOAT(0.5, mat1.readNumber({0, 0, 1}));
  TEST_ASSERT_EQUAL_FLOAT(0.6, mat1.readNumber({1, 0, 1}));
  TEST_ASSERT_EQUAL_FLOAT(-0.7, mat1.readNumber({0, 1, 1}));

  // Clamping
  TEST_ASSERT_EQUAL_FLOAT( 327.67, mat1.readNumber({1, 1, 1}));
  
}



// Run all tests
int main() {
  UNITY_BEGIN();
  RUN_TEST(test_norm_compare);
  RUN_TEST(test_matrix_int);
  RUN_TEST(test_matrix_norm);
  UNITY_END();
  return 0;
}
