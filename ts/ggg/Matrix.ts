import { isArray, isDefined, isNumber, isObject, isRealNumber } from "../common/util"
import { min, max, floor, ceil, toNorm8, toVector } from "../common/math"
import { EventEmitter } from "../common/events"
import { ggggxCodes, ggggxEvents } from "../ggggx/ggggxLang"
import { ggggxDimension, ggggxVecArg, ggggxDimArg } from "./gggLang"
import { gggToken, GGG } from "./gggLang"
import SaveImageData, { ImageData, SaveImageDataOptions, ImageDataArg } from "../ggggx/SaveImageData"

import { DimFrom, DimIterate, DimOffset, DimPad, DimSize } from "./Dim"
import { StorageFromDepth, StorageNormValue, StorageValueNorm } from "../ggggx/Storage"

import { StorageProps, StorageType, StorageTypes } from "../ggggx/Storage"

function DataArgIterate( vec, callback ) {
  for ( let i = 0; i < vec.length; i++ ) {
    callback( vec[i], i )
  }
}


export type MatrixProps = string | number | {
  storage?: StorageProps,
  index?: number,
  name?: string,
  dim?: ggggxDimArg,
  data?: number[],
}

type ggggxReadVecArg = number | number[] | { [key:string]:number }

const BufferDefaults = {
  index: -1,
  name: "",
  storage: 0,
  dim: [1,1,1,1],
}

type saveCodeOptions = {
  lines?: gggToken[],
  header?: boolean,
  encoding?: string,
  region?: number[],
  regions?: number[][],
  chunk?: number,
}


type resizeProps = {
  dim?: ggggxDimArg,
  storage?: StorageProps,
  resample?: boolean,
  data?:number[], 
  dimension?: number,
}

export type clearOptions = ggggxVecArg | {
  data?: ggggxVecArg,
  storage?: StorageProps,
  dim?: ggggxDimArg,
}

export default class Matrix extends EventEmitter {
  name:string = ""
  index:number = -1
  size:number = 0 
  dim: ggggxDimension
  data: any
  storage:StorageType

  constructor( props : MatrixProps = BufferDefaults ) {
    super()

    if ( !isObject( props ) ) {
      props = { storage: props }
    }

    const { 
      index = -1,
      name = "",
      dim = [],
      storage = 0,
      data = [],
    } = props

    this.index = index
    this.name = name
    this.resize( { dim, storage } )
    if ( data && data.length ) {
      this.write( data )
    }
  }

  getDimensions() {
    return this.dim
  }

  getSize() {
    return this.size
  }

  resize( props: resizeProps | ggggxDimArg ) {
    if ( isArray( props ) || isNumber( props ) ) {
      props = { dim: props }
    }

    this.dim = this.dim || []

    let { dim:dimArg, storage:storageArg } = props as resizeProps
    const dim = ( dimArg && DimFrom( dimArg )  ) || [ ...this.dim ]
    storageArg = storageArg || ( this.storage && this.storage.index ) || 0
    const storage:StorageType = StorageTypes.get( storageArg as string | number )


    if ( !storage ) {
      throw new Error( `Matrix.resize: storage type not found: ${storageArg}` )
    }


    let dimsMatch = true
    for( let dimIndex = 0; dimIndex < dim.length || dimIndex < this.dim.length; dimIndex++ ) {
      const thisDimValue = this.dim[dimIndex] >= 1 ? this.dim[dimIndex] : 1
      const dimValue = dim[dimIndex] >= 1 ? dim[dimIndex] : thisDimValue
      dim[dimIndex] = dimValue
      if ( dimValue != thisDimValue ) {
        dimsMatch = false
      }
    }

    while( dim[dim.length-1] == 1 ) {
      dim.pop()
    }

    if ( 
      storage == this.storage 
      && dimsMatch
    ) {
      return false
    } 

    const { dataClass } = storage
    const size = DimSize( dim )
    const data = new dataClass( size )

    if ( this.data && this.storage ) {
      for ( const coord of DimIterate( dim ) ) {
        const value = this.read( coord, 0 ) as number

        let norm = StorageValueNorm( storage, value )
        const index = DimOffset( dim, coord )
        if ( index >= 0 && index < data.length ) {

          data[ index ] = norm
        }
      }
    } else {
      data.fill( 0 )
    }

    this.size = size
    this.dim = dim
    this.data = data
    this.storage = storage
    this.emit( ggggxEvents.Resize, { dim, size, storage } )

    return true
  }

  offset( ...args ) {
    const { dim } = this
    return DimOffset( dim, ...args )
  }

  rectangle() {
    const { dim } = this
    const [ , width, height ] = dim
    return { width, height }
  }

  *coords( dimensions = 1 ) {
    const { dim, size } = this
    const { length } = dim
    const coord:number[] = []
    let stride = 1
    for ( let i = 0; i < dimensions; i++ ) {
      coord.push( 0 )
      stride *= dim[i]
    }
    for ( let i = dimensions; i < length; i++ ) {
      coord.push( 0 )
    }

    for ( let index = 0; index < size; index+=stride ) {
      yield [...coord]
      for ( let dimIndex = dimensions; dimIndex < length; dimIndex++ ) {
        let value = coord[dimIndex]
        value ++
        if ( value >= dim[dimIndex] ) {
          value = 0
          coord[dimIndex] = value
        } else {
          coord[dimIndex] = value
          break
        }
      }
    }
  }

  clear( options: clearOptions = {} ) {

    if ( isNumber( options ) || isArray( options ) ) {
      options = { data: options }
    }

    if ( isObject( options ) ) {
      let { data, storage, dim } = options
      if ( ( !this.dim || !this.size ) && data as number[] ) {
        dim = dim || DimFrom( ( data as number[]).length )
      }
      if ( storage || dim ) {
        this.resize( { dim, storage } )
      }
      if ( data ) {
        this.clearData( data )
      }
    }

  }

  clearData( value:ggggxVecArg = 0 ) {
    value = toVector( value )

    if ( value.length < 1 )
      return

    const stride = value.length
    const { data, dim, size } = this
    let start = -1
    let end = -1

    for ( let i = 0; i < size; i+=stride ) {
      for ( let j = 0; j < stride; j++ ) {
        if ( data[i+j] != value[j] ) {
          data[i+j] = value[j]
          start = start == -1 ? i : start
          end = i + stride
        }
      }
    }

    if ( start >= 0 ) {
      this.emit( ggggxEvents.RegionChange, [ start, end ] )
      return true
    }

    return false
  }

  write( value:ggggxVecArg = [], coord:ggggxVecArg = 0 ) : boolean {
    value = toVector( value )
    const { dim, data, storage } = this
    const coordIndex = DimOffset( dim, coord )

    if ( coordIndex == -1 ) return false

    let start = -1
    let end = -1

    DataArgIterate( value, ( value, index ) => {
      let norm = StorageValueNorm( storage, value )
      const dataIndex = index + coordIndex

      if ( dataIndex >=0 && dataIndex < data.length ) {
        if ( data[ dataIndex ] != norm ) {
          data[ dataIndex ] = norm
          start = start == -1 ? dataIndex : start
          end = dataIndex + 1
        }
      }
    })

    if ( start >= 0 ) {
      this.emit( ggggxEvents.RegionChange, [ start, end ] )
      return true
    }

    return false
  }

  writeImageData( imageData:ImageDataArg, options?:any ) {
    const { resize = true, setStorage = true } = options || {}
    const { width = 1, height = 1, data, channels = 4, depth = 8 } = imageData

    if ( resize || setStorage ) {
      this.resize( { dim: [ channels, width, height ], storage: setStorage ? StorageFromDepth( depth ) : undefined } )
    }

    if ( !data || !isObject( data ) ) {
      throw new Error( `Matrix.writeImageData: invalid imageData` )
    }

    for( let y = 0; y < height; y++ ) {
      for( let x = 0; x < width; x++ ) {
        for ( let c = 0; c < channels; c++ ) {
          const readIndex = ( y * width + x ) * channels + c
          const value = fromNormDepth( data[ readIndex ], depth )
          this.write( value, [ c, x, y ] )
        }
      }
    }
  }

  saveImageData( imageData?:ImageDataArg, options:SaveImageDataOptions = {} ) : ImageData {
    return SaveImageData( this, imageData, options )
  }


  read( coord:ggggxVecArg = 0, value:ggggxReadVecArg = -1 ) {
    const { dim, data, storage } = this
    let index = DimOffset( dim, coord )

    if ( index == -1 ) return value
    if ( isNumber( value ) ) {
      if ( index >= 0 && index < data.length ) {
        const norm = data[ index ]
        value = StorageNormValue( storage, norm )
      }
    } else if ( isArray( value ) ) {
      for ( let i = 0; i < value.length; i++ ) {
        if ( index >= 0 && index < data.length ) {
          const norm = data[ index ]
          value[i] = StorageNormValue( storage, norm )
          index ++
        }
      }
    } else if ( value && isObject( value ) ) {
      const keys = Object.keys( value )
      for ( const i in keys ) {
        const key = keys[i]
        if ( index >= 0 && index < data.length ) {
          const norm = data[ index ]
          const val = StorageNormValue( storage, norm )
          value[key] = val
          index ++
        }
      }
    }

    return value
  }

  readNumber( coord:ggggxVecArg = 0, defaultValue:number = -1 ) {
    const value = this.read( coord, defaultValue )
    return isRealNumber( value ) ? value : defaultValue
  }

  saveCode( { 
    lines = [],
    header = true,
    encoding = "",
    region = [],
    regions = [],
    chunk = 128,
  }:saveCodeOptions = {} ) {
    const { name = "", index = -1, dim, storage } = this
    encoding = encoding || storage.encoding 

    if ( header ) {
      lines.push( { command: ggggxCodes.NumbersInit, args: [
        { code: GGG.Register, data: index },
        { code: GGG.Alias, data: name },
        { code: GGG.Size, data: dim },
        { code: GGG.Storage, data: storage.name },
      ] } )

      if ( ( !regions || !regions.length ) && ( !regions || !region.length ) ) {
        region = [ 0, DimSize( dim ) ]
      }
    }

    if ( region && region.length ) {
      const [ start, end ] = region
      const size = end - start
      const chunkCount = ceil( size / chunk )
      for ( let chunkIndex = 0; chunkIndex < chunkCount; chunkIndex++ ) {
        const chunkStart = start + chunkIndex * chunk
        const chunkEnd = Math.min( chunkStart + chunk, end )
        const chunkSize = chunkEnd - chunkStart
        const data = this.read( chunkStart, new Array( chunkSize ) ) as number[]
        lines.push( {
          command: ggggxCodes.WriteBuffer,
          args: [
            { code: GGG.Register, data: index },
            { code: GGG.Offset, data: [ chunkStart ] },
            { 
              code: GGG.Data, 
              data,
              encoding
            },
          ]
        } )
      }
    }


    if ( regions && regions.length ) {
      for ( const region of regions ) {
        this.saveCode( { lines, header: false, encoding, region, chunk } )
      }
    } 

    return lines
  }


  readIndex( index:number, defaultValue:number = -1 ) {
    const { size } = this
    if ( index < 0 || index >= size ) return defaultValue
    const { data, storage } = this
    const value = StorageNormValue( storage, data[ index ] )
    return isRealNumber( value ) ? value : defaultValue
  }
}


function fromNormDepth( val:number = 0, depth:number = 8 ) {
  switch( depth ) {
    case 8: return val / 255
  }

  return val
}



export function describeBuffer( buffer:Matrix ) {
  const { storage, dim } = buffer
  const { name } = storage
  return `${name}(${dim.toString()})`
}