import { GGG, HookArgs, Hooks } from "../ggg/Language"
import { ggggxEncodingOptions, MatrixEvents } from "./GXLanguage"
import { RegionsAdd } from "./Regions"


async function MatrixWatchHookValue( arg:HookArgs ) {
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
        buffer.on( MatrixEvents.RegionChange, onRegion )
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
  [Hooks.Value]: MatrixWatchHookValue,
}