import { GGG, HexEncodings } from "./Language"

export type HexModifier = {
  digits:number,
  div:number,
  encoding: string,
}

export const HexModifiers = {
  [HexEncodings.HexNorm1]: { digits: 1, div: 0xf, encoding: HexEncodings.HexNorm1 },
  [HexEncodings.HexNorm2]: { digits: 2, div: 0xff, encoding: HexEncodings.HexNorm2 },
  [HexEncodings.HexList1]: { digits: 1, div: 1, encoding: HexEncodings.HexList1 },
  [HexEncodings.HexList2]: { digits: 2, div: 1, encoding: HexEncodings.HexList2 },
}

