import { isArray } from "./util"

const { floor, ceil, min, max, pow, abs } = Math
export { floor, ceil, min, max, pow, abs }

export function trunc( value:number ) : number {
  return value < 0 ? ceil( value ) : floor( value )
}

export function saturate( value:number ) : number {
  return min( 1, max( 0, value ) )
}

export function toNorm8( value:number ) {
  return min( 255, max( 0, floor( value * 255 ) ) ) 
}

export function mod(a: number, n: number): number {
  return (a % n + n) % n
}

export function fract(x: number): number {
  return x - Math.floor(x)
}

export function mix(x: number, y: number, a: number): number {
  return x * (1 - a) + y * a
}

export function toVector( vec : number | number[] ) : number[] {
  if ( !isArray( vec) ) vec = [ vec ]
  return vec
}

type Vec = number[]
type VecArg = Vec | number

export function toVec( a:VecArg ) : Vec {
  if ( isArray( a ) ) return a
  return [ a ]
}

export function toVecFill( a:VecArg, b:Vec ) : Vec {
  if ( !isArray( a ) ) a = [ a ]
  while ( a.length < b.length ) a.push( a[a.length-1] )
  return a
}

export function vecAdd( a:VecArg, b:VecArg ) : Vec {
  a = toVec( a )
  b = toVecFill( b, a )

  const c:number[] = []
  for ( let i = 0; i < a.length; i++ ) c[i] = a[i] + b[i]

  return c
}

export function vecSub( a:VecArg, b:VecArg ) : Vec {
  a = toVec( a )
  b = toVecFill( b, a )

  const c:number[] = []
  for ( let i = 0; i < a.length; i++ ) c[i] = a[i] - b[i]

  return c
}

export function vecMult( a:VecArg, b:VecArg ) : Vec {
  a = toVec( a )
  b = toVecFill( b, a )

  const c:number[] = []
  for ( let i = 0; i < a.length; i++ ) c[i] = a[i] * b[i]

  return c
}

export function vecMix( a:VecArg, b:VecArg, t:number ) : Vec {
  a = toVec( a )
  b = toVecFill( b, a )

  const c:number[] = []
  for ( let i = 0; i < a.length; i++ ) c[i] = mix( a[i], b[i], t )

  return c
}