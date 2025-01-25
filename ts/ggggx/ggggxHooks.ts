import { isString, toInt } from "../common/util"
import { ggggxCodes, ggggxEvents, ggggxFails, ggggxEncodingOptions } from "./ggggxLang" 
import { GGG, gggHooks } from "../ggg/gggLang"
import { gggMachineHookArgs } from "../ggg/gggMachine"
import Matrix, { describeBuffer} from "./Matrix"
import { DimOffset } from "./Dim"
import { toKeyDescription } from "../ggg/gggNamedList"
import { RegionsAdd } from "./Regions"
import { TargetHookCode, TargetHookValue, TargetHookCommand, TargetResolveNumbers } from "./Target"
import { ggggxStorageTypes } from "./Storage"
import { min } from "../common/math"
import ggggxContext from "./ggggxContext"

export function MatrixInitHookCommand( arg:gggMachineHookArgs ) {
  const { state } = arg
  TargetHookCommand( arg, { create: true } )
}

export function MatrixInitHookCode( arg:gggMachineHookArgs ) {
  const { code, state } = arg
  TargetHookCode( arg )
}

export function MatrixInitHookValue( arg:gggMachineHookArgs ) {
  TargetHookValue( arg )

  const { code, state, value, machine } = arg
  switch ( code ) {
    case GGG.Alias:
      const { buffer } = state
      if ( buffer ) {
        buffer.name = value
      }
      break
  }
}


export function MatrixInitHookEnd( arg:gggMachineHookArgs ) {
  const { machine, state } = arg

  const ggggx = ggggxContext( { machine } )
  const { MatrixInit } = ggggx
  const { index, name, dim, storage  } = state || {}
  const key = name || index
  let buffer = MatrixInit({ name, index }, { dim, storage } )
  buffer.clear( { dim, storage})

  if ( !buffer ) {

  }

  machine.output( { code: "G-11", comment: `${toKeyDescription(buffer)} ; ${describeBuffer( buffer)}` } )
}

export const MatrixInitHooks = {
  [gggHooks.Command]: MatrixInitHookCommand,
  [gggHooks.Code]: MatrixInitHookCode,
  [gggHooks.Value]: MatrixInitHookValue,
  [gggHooks.End]: MatrixInitHookEnd,
}

export function ListBuffersHookEnd( arg:gggMachineHookArgs ) {
  const { machine, state } = arg
  const engine = machine.state.ggggx 
  const limits = machine.state.ggggxLimits
  const { buffers } = engine

  machine.output( { code: "G-10" , comment: "buffers:" } )

  for ( const buffer of buffers.list ) {
    if ( buffer ) {
      machine.output( { comment: `  ${toKeyDescription( buffer )} ; ${describeBuffer( buffer )}` } )
    }
  }
}

export const ListBuffersHooks = {
  [gggHooks.End]: ListBuffersHookEnd,
}



export function WriteBufferHookCommand( arg:gggMachineHookArgs ) {
  TargetHookCommand( arg, { create: true } )
}

function WriteBufferHookValue( arg:gggMachineHookArgs ) {
  TargetHookValue( arg )
  const { code, state, value, machine } = arg


  switch( code ) {
    case GGG.Data: {
      TargetResolveNumbers( arg )

      const { offset = 0, coord, buffer } = state
      if ( buffer ) {
        buffer.write( value, offset )
        state.offset = offset + 1
      }
    }
    break
  }
}

function WriteBufferHookEndArg( arg:gggMachineHookArgs ) {
}


export const WriteBufferHooks = {
  [gggHooks.Command]: WriteBufferHookCommand,
  [gggHooks.Code]: TargetHookCode,
  [gggHooks.Value]: WriteBufferHookValue,
  [gggHooks.EndArg]: WriteBufferHookEndArg,
} 

function MatrixReadHookCommand( arg:gggMachineHookArgs ) {
  const { state } = arg
  TargetHookCommand( arg, {} )
}

function MatrixReadHookValue( arg:gggMachineHookArgs ) {
  const { code, state, value, machine } = arg
  const limits = machine.state.ggggxLimits
  TargetHookValue( arg )

}

function MatrixReadHookEnd( arg:gggMachineHookArgs) {
  const { machine, state } = arg
  const { buffer, position, encoding, size } = TargetResolveNumbers( arg )

  if ( !buffer )
    return machine.fail( { comment: ggggxFails.BufferNotFound } )

  if ( !encoding )
    return machine.fail( { comment: ggggxFails.BufferNotFound } )

  const { index, dim, size:bufferSize } = buffer
  let offset = DimOffset( dim, position )
  let { length } = state
  length = length < 0 ? dim[3] : length
  length = min( length, bufferSize - offset )
  const data = buffer.read( [ 0,0,0,offset ], new Array( length ) )
  const tokens = [
    { code: GGG.Register, data: [ index ] },
    { code: GGG.Offset, data: [ offset ] },
    { code: GGG.Data, encoding: encoding.name, data },
  ]
  machine.output( { code: "G-1", tokens } )
}

export const MatrixReadHooks = {
  [gggHooks.Command]: MatrixReadHookCommand,
  [gggHooks.End]: MatrixReadHookEnd,
  [gggHooks.Value]: MatrixReadHookValue,
}


function DisplayHookValue( arg:gggMachineHookArgs ) {
  const { code, value, machine, state } = arg
  const { } = TargetResolveNumbers( arg )
  
  switch( code ) {
    case GGG.Register:
      const context = ggggxContext( { machine } )
      const { MatrixResolve } = context

      const buffer = MatrixResolve( value ) as Matrix
      if ( buffer ) {
        machine.emit( ggggxEvents.Display, { buffer } ) 
      }
      break
  }
}

function DisplayHookEnd( arg:gggMachineHookArgs ) {
  const { machine, state } = arg
}

export const DisplayHooks = {
  [gggHooks.Value]: DisplayHookValue,
  [gggHooks.End]: DisplayHookEnd,
}

async function MatrixDumpHookValue( arg:gggMachineHookArgs ) {
  const { code, state, value, machine } = arg
  
  switch( code ) {
    case GGG.Encoding:
      state.encoding = ggggxEncodingOptions.get( value as string )
      break

    case GGG.Register:
      const { buffer } = TargetResolveNumbers( arg )

      // if ( !buffer )
      //   return machine.fail( { comment: ggggxFails.BufferNotFound } )

      const { encoding = ggggxEncodingOptions.get()  } = state

      // if ( !encoding )
      //   return machine.fail( { comment: ggggxFails.EncodingNotFound } )

      const lines = buffer ? buffer.saveCode( { encoding: encoding.encoding } ) : []
      machine.output( lines )
      break
  }
}

export const MatrixDumpHooks = {
  [gggHooks.Value]: MatrixDumpHookValue,
}


async function MatrixWatchHookValue( arg:gggMachineHookArgs ) {
  const { code, state, value, machine } = arg
  const bufferWatchers = state.bufferWatchers = state.bufferWatchers || {}


  const engine = machine.state.ggggx 
  const limits = machine.state.ggggxLimits
  const { buffers } = engine
  
  switch( code ) {
    case GGG.Encoding:
      state.encoding = ggggxEncodingOptions.get( value as string )
      break

    case GGG.Register:
      const key = value as string
      const watcher = bufferWatchers[key] = bufferWatchers[key] || {}
      let header = false
      const buffer = buffers.get( key )

      const regions = watcher.regions = watcher.regions || [ [ 0, buffer.size ] ]

      const onRegion = watcher.onRegion = watcher.onRegion || (( region ) => {
        watcher.regions = RegionsAdd( region, watcher.regions )
      })

      if ( !watcher.listening ) {
        watcher.listening = true
        buffer.on( ggggxEvents.RegionChange, onRegion )
      }

      const spec = `${buffer.name}:${buffer.dim}`
      
      if ( watcher.spec !== spec ) {
        watcher.spec = spec
        header = true
      } 

      if ( header || (regions && regions.length) ) {
        const { encoding = ggggxEncodingOptions.get()  } = state
        const lines = buffer.saveCode( { header, regions, encoding: encoding.encoding } )
        machine.output( lines )
        watcher.regions = []
      }

      break
  }
}


export const MatrixWatchHooks = {
  [gggHooks.Value]: MatrixWatchHookValue,
}