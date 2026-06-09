import { GGG, Hooks, HookArgs } from "../ggg/Language"
import { isString, isNumber, toInt } from "../common/util"
import Matrix from "../ggg/Matrix"
import { Blit, BlitOptions } from "./Blit"
import { CombineList, EdgeList } from "./Sample"

//
// MatrixBlit (G40): copy from a SOURCE register into a DESTINATION register
// through a spatial transform, by inverse mapping. The heavy lifting lives in
// the Blit driver (./Blit.ts); this is just the command-arg plumbing.
//
// Arg map:
//   R / L   -- source register (sampled)   [index | name]
//   W       -- destination register (written; Q combines here)
//   M       -- transform coefficients, interpreted per the mode (box = source
//             min,max pairs in pixel coords; map = (srcAxis,min,max) triples,
//             one per dest axis, so axes can swap; affine = matrix)
//   T       -- transform mode (box [default] / affine / map; index | name)
//             ( T is the Storage glyph reused contextually -- G40 has no storage arg )
//   P / S   -- dest region offset / size (default whole dest spatial extent)
//   D       -- channel-dimension count (default 0 = all axes spatial)
//   Q       -- operator combining the sampled value into the dest cell (default set)
//   F       -- per-axis combine op (list, continue-last): 0 linear / 1 nearest /
//             2 min / 3 max / 4 add. Interp up, fold (pool) down. (Failure glyph
//             reused contextually.)
//   E       -- per-axis edge (list, continue-last): 0 loop / 1 hold / 2 mirror /
//             3 zero. (Encoding glyph reused contextually -- G40 has no encoding.)
//

function reset( state: { [key: string]: any } ) {
  state.sourceRef = undefined
  state.destRef = undefined
  state.matrix = []
  state.mode = undefined
  state.blitOffset = []
  state.blitSize = []
  state.dimension = undefined
  state.operator = undefined
  state.combine = []   // F: per-axis combine op names
  state.edges = []     // E: per-axis edge names
}

// Map an arg value (index or name) to an option name via the index-order list.
function optName( value: number | string, list: string[] ): string {
  return isNumber( value ) ? ( list[ value ] ?? list[0] ) : ( value as string )
}

function MatrixBlitHookCommand( arg: HookArgs ) {
  reset( arg.state )
}

function MatrixBlitHookValue( arg: HookArgs ) {
  const { code, state, value } = arg
  switch ( code ) {
    case GGG.Register:
      state.sourceRef = value
      break
    case GGG.Alias:
      if ( isString( value ) ) state.sourceRef = value
      break
    case GGG.Target:
      state.destRef = value
      break
    case GGG.Transform:
      if ( isNumber( value ) ) state.matrix.push( value )
      break
    case GGG.Storage:
      state.mode = value
      break
    case GGG.Offset:
      state.blitOffset.push( toInt( value ) )
      break
    case GGG.Size:
      state.blitSize.push( toInt( value ) )
      break
    case GGG.Dimension:
      state.dimension = toInt( value )
      break
    case GGG.Operator:
      state.operator = value
      break
    case GGG.Failure:   // F -- per-axis combine op (list)
      state.combine.push( optName( value, CombineList ) )
      break
    case GGG.Encoding:  // E -- per-axis edge (list)
      state.edges.push( optName( value, EdgeList ) )
      break
  }
}

function MatrixBlitHookEnd( arg: HookArgs ) {
  const { machine, state } = arg

  const source = machine.getMatrix( state.sourceRef ) as Matrix | undefined
  const dest = machine.getMatrix( state.destRef ) as Matrix | undefined

  if ( !source || !dest ) {
    machine.outputOk( 0 )
    return
  }

  const options: BlitOptions = {
    dimension: state.dimension,
    mode: state.mode,
    matrix: state.matrix,
    offset: state.blitOffset.length ? state.blitOffset : undefined,
    size: state.blitSize.length ? state.blitSize : undefined,
    operator: state.operator,
    combine: state.combine.length ? state.combine : undefined,
    edges: state.edges.length ? state.edges : undefined,
  }

  Blit( dest, source, options )
  machine.outputOk()
}

export const MatrixBlitHooks = {
  [Hooks.Command]: MatrixBlitHookCommand,
  [Hooks.Value]: MatrixBlitHookValue,
  [Hooks.End]: MatrixBlitHookEnd,
}
