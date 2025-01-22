import { vecAdd } from "../ts/common/math"

describe("math", () => {
  describe("vecAdd", () => {
    test("N + N", () => {
      expect(vecAdd(1, 2)).toEqual([3])
    })

    test("N[] + N", () => {
      expect(vecAdd([1, 2], 3)).toEqual([4, 5])
    })

    test("N[] + N[]", () => {
      expect(vecAdd([1, 2], [3, 4])).toEqual([4, 6])
    })
  })
})