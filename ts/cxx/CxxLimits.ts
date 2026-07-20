//
// Source of truth for the generated C++ machine limits (cxx/include/ggg/Limits.h).
// These are embedded/build-time constraints specific to the C++ implementation
// (the TS runtime grows its structures dynamically and does not need them).
//
export const CxxMachineLimits = {
  maxAxes: 4,
  maxBuffer: 1024,
  maxOperations: 1024,
  maxRegisters: 256,
  maxRegisterSize: 0x10000,
  // Upper bound on queued procedure-body lines (flow control), guarding against
  // runaway recursion / unbounded queue growth when re-running procedures.
  maxQueue: 1024,
  // Upper bound on procedures exported as asynchronous (T12) at once.
  maxAsync: 16,
}
