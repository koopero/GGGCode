import Matrix, { clearOptions } from "./Matrix"
import GGGGX, { MatrixLimits} from "./ggggxLang"
import Machine from "../ggg/Machine"
import { Solver } from "./Solve"
import { clear } from "console"
import { isDefined, isObject } from "../common/util"
import { gggCommands } from "../ggg/gggLang"



type ContextOptions = {
  registers?: { [key: string]: number[] },
  machine?: Machine,
  commands?: gggCommands,
  limits?: MatrixLimits
}

type MatrixLookupArg = number | string | { name?:string, index?:number } | Matrix
type MatrixInitOptions = { name?:string, index?:number, dim?:number[], storage?:number }

export default function ggggxContext( options?: ContextOptions ) {

  let { registers, machine, commands, limits } = options || {}

  if ( !machine ) {
    machine = new Machine( { commands, limits } )
  }

  if ( registers ) {
    for ( let name in registers ) {
      let register = machine.getRegister( GGGGX, name, new Matrix() ) as Matrix
      let clearData = registers[name]
      register.clear( clearData )
    }
  }

  const MatrixResolve = ( name ) => {
    return machine.getRegister( GGGGX, name ) as Matrix
  }

  // function addRegister( name, data ) {
  //   let register = machine.getRegister( GGGGX, name, new Matrix() ) as Matrix
  //   register.clear( data )
  // }

  function *Solve( arg, options = {}) {
    yield *Solver( arg, { MatrixResolve, ...options } )
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
    
    let search = name || index
    let buffer = MatrixResolve( search )
    if ( !buffer ) {
      buffer = new Matrix( { name, index } )
      machine?.getRegister( GGGGX, search, buffer )
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
    Solve,
  }
}