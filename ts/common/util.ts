
export function isString( token:any ) : token is string {  
  return typeof token === "string"
}

export function isObject( token:any ) : token is object {
  return typeof token === "object" && token !== null
}

export function isArray( token:any ) : token is any[] {
  return Array.isArray( token )
}

export function isNumber( token:any ) : token is number {
  return typeof token === "number"
}

export function isRealNumber( token:any ) : token is number {
  return isNumber( token ) && !isNaN( token )
}

export function toInt( token:any ) : number {
  return parseInt( token )
}

export function toString( token:any ) : string {
  return token ? token.toString() : ""
}

export function isBoolean( token:any ) : token is boolean {
  return typeof token === "boolean"
}

export function isDefined( token:any ) : boolean {
  return token !== undefined
}

export function isUndefined( token:any ) : boolean {
  return token === undefined
}

export function isFunction( token:any ) : token is Function {
  return typeof token === "function"
}