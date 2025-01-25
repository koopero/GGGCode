import Matrix from "./Matrix"

import { decode } from "fast-png"
import type { ImageData } from "./SaveImageData"

export default function LoadPNG( data:Uint8Array, options:any, buffer?:Matrix ) : Matrix {
  const imageData = decode( data )
  buffer = buffer || new Matrix()

  buffer.writeImageData( imageData as ImageData, options )

  return buffer
}