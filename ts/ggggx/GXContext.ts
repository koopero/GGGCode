import Matrix, { clearOptions } from "../ggg/Matrix"
import { MatrixLimits} from "./GXLanguage"
import Machine from "../ggg/Machine"
import { Solve } from "../ggg/Solve"
import { clear } from "console"
import { isDefined, isObject } from "../common/util"
import type { Commands } from "../ggg/Language"

type ContextOptions = {
  registers?: { [key: string]: number[] },
  machine?: Machine,
  commands?: Commands,
  limits?: MatrixLimits
}

type MatrixLookupArg = number | string | { name?:string, index?:number } | Matrix
type MatrixInitOptions = { name?:string, index?:number, dim?:number[], storage?:number }

export function GXContext( options?: ContextOptions ) {

  let { registers, machine, commands, limits } = options || {}

  if ( !machine ) {
    machine = new Machine( { commands, limits } )
  }

  if ( registers ) {
    for ( const name in registers ) {
      const register = machine.getRegister( Matrix, name, new Matrix() ) as Matrix
      const clearData = registers[name]
      register.clear( clearData )
    }
  }

  const MatrixResolve = ( name ) => {
    return machine.getRegister( Matrix, name ) as Matrix
  }

  // function addRegister( name, data ) {
  //   let register = machine.getRegister( GGGGX, name, new Matrix() ) as Matrix
  //   register.clear( data )
  // }

  function *SolveLocal( arg, options = {}) {
    yield *Solve( arg, { MatrixResolve, ...options } )
  }

  function MatrixInit( lookup:MatrixLookupArg, clear?:MatrixInitOptions ) {
    if ( lookup instanceof Matrix ) {
      return lookup
    } 
    
    let name
    let index = -1
    if ( typeof lookup === "string" ) {
      name = lookup
    } else if ( typeof lookup === "number" ) {
      index = lookup
    } else if ( isObject( lookup ) ) {
      name = lookup.name
      index = lookup.index || -1
    }
    
    const search = name || index
    let buffer = MatrixResolve( search )
    if ( !buffer ) {
      buffer = new Matrix( { name, index } )
      machine?.getRegister( Matrix, search, buffer )
    }

    if ( buffer && clear ) {
      buffer.clear( clear )
    }

    return buffer
  }

  return {
    machine,
    MatrixResolve,
    MatrixInit,
    Solve: SolveLocal,
  }
}