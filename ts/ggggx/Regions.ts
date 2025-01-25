import { min, max } from "../common/math"

type Region = [number, number]; // Define a type for intervals

export function *RegionsAddGen( add: Region, list: Region[] = [] ): Generator<Region> {
  const [ addStart, addEnd ] = add

  let merged = false
  let accStart = -1
  let accEnd = -1

  for ( const region of list ) {
    if ( merged ) {
      yield region
      return
    }
    const [ start, end ] = region
    if ( addEnd < start ) {
      yield add
      yield region
      merged = true
    } else if ( accEnd != -1 && start > accEnd ) {
      yield [ accStart, accEnd ]
      yield region
      merged = true
    } else if ( accEnd != -1 ) {
      accEnd = max( end, accEnd )
    } else if ( addStart < end ) {
      accStart = min( start, addStart )
      accEnd = max( end, addEnd )
    } else {
      yield region
    }
  }

  if ( accEnd != -1 && !merged ) {
    yield [ accStart, accEnd ]
  } else if ( !merged ) {
    yield add
  }
}

export function RegionsAdd( add: Region, list: Region[] = [] ) {
  return [ ...RegionsAddGen( add, list ) ]
}
