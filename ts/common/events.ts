type EventName = string | symbol
type EventListener = ( ...args:any[] ) => void

// The runtime only needs the small, portable core of Node's EventEmitter.
// Keeping it here makes Machine and Matrix genuinely browser-safe instead of
// relying on a bundler to shim the Node `events` built-in.
export class EventEmitter {
  private listeners:Map<EventName,EventListener[]> = new Map()

  on( event:EventName, listener:EventListener ) : this {
    const listeners = this.listeners.get( event ) || []
    listeners.push( listener )
    this.listeners.set( event, listeners )
    return this
  }

  off( event:EventName, listener:EventListener ) : this {
    const listeners = this.listeners.get( event )
    if ( !listeners ) return this
    for ( let index = listeners.length - 1; index >= 0; index-- ) {
      if ( listeners[index] === listener ) {
        listeners.splice( index, 1 )
        break
      }
    }
    if ( !listeners.length ) this.listeners.delete( event )
    return this
  }

  emit( event:EventName, ...args:any[] ) : boolean {
    const listeners = this.listeners.get( event )
    if ( !listeners?.length ) return false
    // Snapshot before dispatch so a listener can safely add/remove listeners.
    for ( const listener of [ ...listeners ] ) listener( ...args )
    return true
  }
}
