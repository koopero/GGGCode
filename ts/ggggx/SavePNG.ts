import Matrix from "../ggg/Matrix"
import SaveImageData, { SaveImageDataOptions } from "./SaveImageData"
import { encode, ImageData as LibImageData } from "fast-png"

export default function SavePNG( buffer:Matrix, options?:SaveImageDataOptions ) {
  const imageData = SaveImageData( buffer, {}, options )
  const encoderOptions = {}
  const data = encode( imageData as LibImageData, encoderOptions )
  return data
}

