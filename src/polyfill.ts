if (!Array.prototype.findLast) {
  Array.prototype.findLast = function <T>(
    predicate: (value: T, index: number, obj: T[]) => boolean,
    thisArg?: any
  ): T | undefined {
    if (this == null) {
      throw new TypeError('Array.prototype.findLast called on null or undefined')
    }
    if (typeof predicate !== 'function') {
      throw new TypeError('predicate must be a function')
    }
    const list = Object(this)
    const length = list.length >>> 0
    let value: T

    for (let i = length - 1; i >= 0; i--) {
      value = list[i]
      if (predicate.call(thisArg, value, i, list)) {
        return value
      }
    }
    return undefined
  }
}

if (typeof AggregateError === 'undefined') {
  class AggregateError extends Error {
    errors: any[]

    constructor(errors: any[], message?: string) {
      super(message)
      this.errors = errors
      this.name = 'AggregateError'
    }
  }

  ;(globalThis as any).AggregateError = AggregateError
}

if (!Promise.any) {
  Promise.any = function <T>(promises: Iterable<T | PromiseLike<T>>): Promise<Awaited<T>> {
    return new Promise<Awaited<T>>((resolve, reject) => {
      const values = Array.from(promises)
      const errors: any[] = []
      let pending = values.length

      if (pending === 0) {
        return reject(new AggregateError([], 'All promises were rejected'))
      }

      values.forEach((promise, index) => {
        Promise.resolve(promise)
          .then(resolve)
          .catch((error) => {
            errors[index] = error
            pending -= 1
            if (pending === 0) {
              reject(new AggregateError(errors, 'All promises were rejected'))
            }
          })
      })
    })
  }
}
