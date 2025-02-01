#include <unity.h>
#include "Normal.h"

void setUp() {}
void tearDown() {}

// Test functions
void test_equal_simple() {
  NormalizedNumber<int16_t, 200> a(0.25);
  NormalizedNumber<uint8_t, 200> b(0.25);
  TEST_ASSERT( a == b );
}

void test_equal_different() {
  NormalizedNumber<int16_t, 2000> a(0.25);
  NormalizedNumber<uint8_t, 200> b(0.25);
  TEST_ASSERT( a == b );
}

void test_compare() {
  float OneA = 1;
  float TwoA = 2;
  NormalizedNumber<int16_t, 400> OneB(1);
  NormalizedNumber<uint8_t, 200> OneC(1);
  NormalizedNumber<int16_t, 400> TwoB(2);
  NormalizedNumber<uint8_t, 200> TwoC(2);
  
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


// Run all tests
int main() {
  UNITY_BEGIN();
  RUN_TEST(test_equal_simple);
  RUN_TEST(test_equal_different);
  RUN_TEST(test_compare);
  UNITY_END();
  return 0;
}
