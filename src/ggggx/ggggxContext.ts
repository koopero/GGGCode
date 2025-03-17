import Matrix, { clearOptions } from "./Matrix"
import GGGGX from "./ggggxLang"
import gggMachine from "../ggg/gggMachine"
import { gggSolver } from "./Solve"
import { clear } from "console"
import { isDefined, isObject } from "../common/util"

type ggggxContextOptions = {
  registers?: { [key: string]: number[] },
  machine?: gggMachine,
}

type BufferLocalArg = number | string | { name?:string, index?:number } | Matrix
type MatrixInitOptions = { name?:string, index?:number, dim?:number[], storage?:number }

export default function ggggxContext( options?: ggggxContextOptions ) {

  let { registers, machine } = options || {}

  if ( !machine ) {
    machine = new gggMachine()
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
    yield *gggSolver( arg, { MatrixResolve, ...options } )
  }

  function MatrixInit( lookup:BufferLocalArg, clear?:MatrixInitOptions ) {
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