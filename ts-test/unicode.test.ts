import ParseData from "../ts/ggg/ParseData"


const funUnicodeChars: string[] =  [...`⚡🚀🐉🎩🦄🀄🎶🔱🔮` ]
function getRandomUnicodeChar(): string {
  return funUnicodeChars[Math.floor(Math.random() * funUnicodeChars.length)];
}


describe("ts:unicode", () => {
  describe("ParseData", () => {
    test("higher code points interpreted as numbers", () => {
      const str = getRandomUnicodeChar()
      const codePoint = str.codePointAt(0) || 0
      expect( ParseData(str) ).toEqual([[codePoint], ""])
    })

    test("multiple unicode char", () => {
      const chr = getRandomUnicodeChar()
      const codePoint1 = chr.codePointAt(0) || 0
      const codePoint2 = 0x1f4a9
      const str = `${chr}💩`
      expect( ParseData(str) ).toEqual([[codePoint1, codePoint2], ""])
    })

    test("mix with default data", () => {
      const codePoint1 = 0x1f4a9
      const value = 123.4
      const codePoint2 = 0x1f4a9
      const str = `💩${value}💩`
      expect( ParseData(str) ).toEqual([[codePoint1, value, codePoint2], ""])
    })
  })
})