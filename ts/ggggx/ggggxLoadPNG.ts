import ggggxBuffer from "./ggggxBuffer"

import { decode } from "fast-png"
import type { ImageData } from "./SaveImageData"

export default function ggggxLoadPNG( data:Uint8Array, options:any, buffer?:ggggxBuffer ) : ggggxBuffer {
  const imageData = decode( data )
  buffer = buffer || new ggggxBuffer()

  buffer.writeImageData( imageData as ImageData, options )

  return buffer
}