import Matrix from "./Matrix"
import { StorageClass } from "./Storage"
import { isNumber, isArray, isObject } from "../common/util"
import { DimPad, DimOffset } from "./Dim"
import { floor, min, trunc, abs } from "../common/math"


export type SaveImageDataOptions = number[] | {
  coord?: number[]
  dimension?: number
  width?: number
  height?: number
  data?: any
  channels?: number
  depth?: number
}

export type ImageDataArg = {
  width?: number,
  height?: number,
  data?: StorageClass,
  channels?: number,
  depth?: number,
}

export type ImageData = {
  width: number,
  height: number,
  data: StorageClass
  channels: number,
  depth: number,
}


function SaveImageDataParseOptions( options:SaveImageDataOptions ) {
  if ( isNumber( options ) ) {
    options = { coord: [ options ] }
  } else if ( isArray( options ) ) {
    options = { coord: options }
  } else if ( !isObject( options ) ) {
    options = {}
  }

  return options
}

export type SaveSource = Matrix | number[]


function resolveSaveSourceBuffer( buffer:SaveSource ) {
  if ( isArray( buffer ) ) {
    return new Matrix( {
      data: buffer,
      dim: [ buffer.length ]
    } )
  } else {
    return buffer
  }
}



export default function SaveImageData( buffer:SaveSource, imageData?:ImageDataArg, options:SaveImageDataOptions = {} ) : ImageData {
  buffer = resolveSaveSourceBuffer( buffer )
  options = SaveImageDataParseOptions( options )
  const { coord = [], dimension = 1 } = options
  const { storage } = buffer
  const dim = DimPad( buffer.dim, dimension + 2 )
  const sourceChannels = dimension > 0 ? dim[0] : 1
  const sourceWidth = dim[dimension]
  const sourceHeight = dim[dimension+1]

  for ( let i = 0; i < dim.length || i < coord.length || i < dimension + 2; i++ ) {
    coord[i] = +coord[i] || 0
  }

  const template = imageData ? { ...imageData, ...options } : options
  let { width = 0, height = 0, data, channels = 0, depth = 8 } = template
  imageData = imageData || {}

  width = floor( width > 0 ? width : sourceWidth - coord[dimension] )
  height = floor( height > 0 ? height : sourceHeight - coord[dimension+1] )
  channels = channels > 0 ? channels : min( 4, sourceChannels )

  const startIndex = DimOffset( dim, coord )

  let index = 0
  const size = width * height * channels

  data = data || typedArrayForDepth( size, depth )

  for ( let y = 0; y < height; y++ ) {
    for ( let x = 0; x < width; x++ ) {
      let dataIndex = startIndex + ( y * sourceWidth + x ) * sourceChannels
      for ( let c = 0; c < channels; c++ ) {
        const value = c < sourceChannels ? buffer.readIndex( dataIndex++ ) : 1
        data[ index++ ] = toNormDepth( value, depth )
      }
    }
  }

  if ( imageData.data != data ) imageData.data = data
  if ( imageData.width != width ) imageData.width = width
  if ( imageData.height != height ) imageData.height = height

  imageData.depth = depth
  imageData.channels = channels

  return imageData as ImageData
}

function roundDepth( depth:number ) {
  if ( depth <= 8 ) return 8
  if ( depth <= 16 ) return 16
  return 32
}

function typedArrayForDepth( size:number, depth:number ) {
  if ( !depth ) return new Array( size )
  if ( abs( depth ) < 1/64 ) new Float64Array( size )
  if ( abs( depth ) < 1/32 ) new Float32Array( size )
  if ( depth < 0 ) {
    if ( depth >= -8 ) return new Int8Array( size )
    if ( depth >= -16 ) return new Int16Array( size )
    return new Int32Array( size )
  } else {
    if ( !depth || depth < 0 ) return new Array( size )
    if ( depth <= 8 ) return new Uint8Array( size )
    if ( depth <= 16 ) return new Uint16Array( size )
    return new Uint32Array( size )
  }
}

function toNormDepth( val:number = 0, depth:number = 8 ) {
  if ( depth < 0 ) {
    depth = -depth - 1
  }
  val = trunc( val * ( (2 ** depth) - 1 ) )
  return val
}

