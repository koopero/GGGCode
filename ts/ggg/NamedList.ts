import { isArray, isNumber, isString } from "../common/util"

export type NamedListItem = {
  name?: string,
  index?: number,
}

export function toNamedListKey( key:string|number|{ index?:number, name?:string} ) {

  if ( isString( key ) ) {
    key = { name: key }
  } else if ( isNumber( key ) ) {
    key = { index: key }
  }

  const { index = -1, name = "" } = key as { index?:number, name?:string }

  return { index, name }
}

export function toKeyDescription( key:string|number|{ index?:number, name?:string} ) {
  const { index = -1, name = "" } = toNamedListKey( key )

  let result = ""
  result += index.toString()
  if ( name ) {
    result += "|"
    result += `"${name}"`
  }

  return result
}

export default class NamedList<T extends NamedListItem> {
  named: { [key:string]:T } = {}
  list: T[] = []
  constructor( item?:{ [key:string]:T }|T[] ) {
    if ( isArray( item ) ) {
      (item as any[]).map( ( item ) => {
        this.add( item )
      } )
    } else if ( item as { [key:string]:T } ) {
      for ( const key in item ) {
        this.add( item[key], key )
      }
    }
  }

  add( item:T, key?:string|number|{ index?:number, name?:string} ) {
    const { named, list } = this
    
    const keyedItem = toNamedListKey( key || item )
    let { index = -1 } = keyedItem
    const { name = "" } = keyedItem


    if ( index < 0 || isNaN( index ) )
      index = list.length

    item.index = index
    item.name = item.name || name
    list[index] = item
    named[item.name] = item

    return item
  }

  setItemName( item:T, name:string ) {
    const { named, list } = this
    for ( let key in named ) {
      if ( named[key] === item ) {
        delete named[key]
        break
      }
    }
    
    named[name] = item
    item.name = name
    return item
  }

  get( key:string|number|null = null ) {
    const { named, list } = this
    if ( key === null ) {
      return list[0]
    }

    if ( isString( key ) && key in named ) {
      return named[key]
    }

    key = parseInt( key as string ) || 0

    return this.list[key]
  }

  eachPair( callback:( item:T, key:string ) => any ) {
    const { list } = this
  
    for ( const item of list ) {
      if ( !item) continue
      const { name, index = -1 } = item
      let key = ""
      if ( index >= 0 ) {
        key = index.toString()
      }

      if ( name ) {
        if ( key ) key += "|"
        key += `"${name}"`
      }
      callback( item, key )
    }
  }
}
