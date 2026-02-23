import { GGG } from "./Language"

export type HexModifier = {
  digits:number,
  div:number,
  encoding: string,
}

export const HexModifiers = {
  [GGG.HexNorm1]: { digits: 1, div: 0xf, encoding: GGG.HexNorm1 },
  [GGG.HexNorm2]: { digits: 2, div: 0xff, encoding: GGG.HexNorm2 },
  [GGG.HexList1]: { digits: 1, div: 1, encoding: GGG.HexList1 },
  [GGG.HexList2]: { digits: 2, div: 1, encoding: GGG.HexList2 },
}

