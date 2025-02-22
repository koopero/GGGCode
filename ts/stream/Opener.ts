import { EventEmitter } from "../common/events"
import { max } from "../common/math"

type OpenOptions = {
  callback?: () => Promise<void>
  retry?: number
  retryDelay?: number
  timeout?: number
  cooldown?: number
}

enum OpenerState {
  Closed,
  Open,
  Opening,
  Retrying,
  Error,
  Destroyed,
  Closing,
}

const now = () => new Date().getTime()

type OpenToken<T> = {
  onOpen: (err: Error | null) => void
  promise: Promise<T | null> | null
  status: OpenerState
  options?: OpenOptions
  impl: T | null
  retry: number
  started: number
  close: () => void
  error?: Error | null
}

export default class Opener<T> extends EventEmitter {
  status: OpenerState = OpenerState.Closed
  private _impl: T | null = null
  private _open: OpenToken<T>[]
  private _timer: NodeJS.Timeout | null
  private _timerTime: number = Infinity
  private cooldownStart: number = 0
  private generator: () => T

  constructor(generator: () => T) {
    super()
    this.generator = generator
    this._open = []
    this._timer = null

    this.onOpen = this.onOpen.bind(this)
    this.onError = this.onError.bind(this)
    this.onData = this.onData.bind(this)
    this.onTimer = this.onTimer.bind(this)
  }

  private onOpen() {
    this.status = OpenerState.Open
    for (const token of this._open) {
      if (token.status == OpenerState.Opening) {
        token.impl = this._impl
        token.onOpen(null)
      }
    }
  }

  private onError(error: Error) {
    for (const token of this._open) {
      if (token.status == OpenerState.Opening) {
        token.status = OpenerState.Error
        token.error = error
        token.onOpen(error)
      }
    }
  }

  private onData(data: any) {
    this.emit("data", data)
  }

  private setTimer(time: number = 0) {
    const forTime = now() + time
    if (this._timer) {
      if (forTime < this._timerTime) {
        clearTimeout(this._timer)
        this._timer = null
      }
    }
    this._timer = this._timer || setTimeout(this.onTimer, time)
    this._timerTime = forTime
  }

  private onTimer() {
    this._timer = null
    this._timerTime = Infinity
    this.iterate()
  }

  iterate() {
    let shouldClose = true
    let shouldOpen = false
    let cooldown = 0

    this._open = this._open.filter(token => {
      switch (token.status) {
        case OpenerState.Closed:
          cooldown = max(cooldown, token.options?.cooldown || 0)
          return false

        case OpenerState.Opening:
        case OpenerState.Open:
          shouldClose = false
          shouldOpen = true
      }
      return true
    })

    if (shouldClose && this.status == OpenerState.Open) {
      if (this.cooldownStart > 0) {
        cooldown -= now() - this.cooldownStart
      }
      this.status = OpenerState.Closing
      if (cooldown > 0) {
        this.cooldownStart = now()
        this.setTimer(cooldown)
      } else {
        this.closeActual()
      }
    } else if (shouldOpen && this.status !== OpenerState.Open && this.status !== OpenerState.Opening) {
      this.status = OpenerState.Opening
      this.openActual()
    }
  }

  open(options?: OpenOptions): OpenToken<T> {
    if (this.status === OpenerState.Destroyed) {
      throw new Error("Opener is destroyed")
    }

    const token: OpenToken<T> = {
      promise: null,
      status: OpenerState.Opening,
      impl: null,
      options,
      retry: 0,
      started: now(),
      onOpen: () => {},
      close: () => {},
    }

    token.close = () => {
      token.status = OpenerState.Closed
      this.setTimer()
    }

    token.promise = new Promise<T | null>((resolve, reject) => {
      token.onOpen = (err) => {
        if (err) {
          reject(err)
        } else {
          resolve(token.impl)
        }
      }
    })

    this._open.push(token)
    this.setTimer()

    return token
  }

  close(options: OpenOptions = {}): Promise<void> {
    return Promise.resolve()
  }

  async closeActual() {
    const impl = this._impl
    if (!impl) return
    this.implDetach(impl)
    this._impl = null
    let implCloseError: Error | null = null
    if (typeof impl["close"] === "function") {
      try {
        await impl["close"].bind(impl)()
      } catch (err) {
        implCloseError = err
      }
    }
    for (const token of this._open) {
      if (token.impl === impl) {
        token.status = OpenerState.Closed
        token.error = token.error || implCloseError
        token.impl = null
      }
    }
  }

  async openActual() {
    try {
      const impl = await this.generator()
      this.implAttach(impl)
      this._impl = impl
    } catch (error) {
      this.onError(error as Error)
    }
  }

  async withOpen<RT>(callback: (impl: T) => Promise<RT>, options: OpenOptions = {}): Promise<RT> {
    const token = this.open(options)
    await token.promise
    if (!token.impl) throw new Error("Failed to open implementation")
    const result = await callback(token.impl)
    token.close()
    return result
  }

  private implAttach(impl: T) {
    if (typeof impl["on"] === "function") {
      impl["on"].bind(impl)("open", this.onOpen)
      impl["on"].bind(impl)("error", this.onError)
      impl["on"].bind(impl)("data", this.onData)
    }
  }

  private implDetach(impl: T) {
    if (typeof impl["off"] === "function") {
      impl["off"].bind(impl)("open", this.onOpen)
      impl["off"].bind(impl)("error", this.onError)
      impl["off"].bind(impl)("data", this.onData)
    }
  }
}