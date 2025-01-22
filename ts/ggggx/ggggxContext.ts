import ggggxBuffer, { clearOptions } from "./ggggxBuffer"
import GGGGX from "./ggggxLang"
import gggMachine from "../ggg/gggMachine"
import { gggSolver } from "../ggg/gggSolver"
import { clear } from "console"
import { isDefined, isObject } from "../common/util"

type ggggxContextOptions = {
  registers?: { [key: string]: number[] },
  machine?: gggMachine,
}

type BufferLocalArg = number | string | { name?:string, index?:number } | ggggxBuffer
type BufferInitOptions = { name?:string, index?:number, dim?:number[], storage?:number }

export default function ggggxContext( options?: ggggxContextOptions ) {

  let { registers, machine } = options || {}

  if ( !machine ) {
    machine = new gggMachine()
  }

  if ( registers ) {
    for ( let name in registers ) {
      let register = machine.getRegister( GGGGX, name, new ggggxBuffer() ) as ggggxBuffer
      let clearData = registers[name]
      register.clear( clearData )
    }
  }

  const getRegister = ( name ) => {
    return machine.getRegister( GGGGX, name ) as ggggxBuffer
  }

  // function addRegister( name, data ) {
  //   let register = machine.getRegister( GGGGX, name, new ggggxBuffer() ) as ggggxBuffer
  //   register.clear( data )
  // }

  function *solver( arg, options = {}) {
    yield *gggSolver( arg, { getRegister, ...options } )
  }

  function BufferInit( lookup:BufferLocalArg, clear?:BufferInitOptions ) {
    if ( lookup instanceof ggggxBuffer ) {
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
    let buffer = getRegister( search )
    if ( !buffer ) {
      buffer = new ggggxBuffer( { name, index } )
      machine?.getRegister( GGGGX, search, buffer )
    }

    if ( buffer && clear ) {
      buffer.clear( clear )
    }

    return buffer
  }

  return {
    machine,
    getRegister,
    BufferInit,
    solver,
  }
}