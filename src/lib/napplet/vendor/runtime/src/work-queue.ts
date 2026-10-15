/** Bounded concurrency with abortable waiting; stopped frames never start queued requests. */
export class WorkQueue {
  private active = 0
  private waiting: { start: () => void; cancel: () => void }[] = []
  constructor(
    private concurrency: number,
    private maxWaiting: number
  ) {}
  run<T>(signal: AbortSignal, work: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      if (signal.aborted) {
        reject(new Error('cancelled'))
        return
      }
      if (this.active >= this.concurrency && this.waiting.length >= this.maxWaiting) {
        reject(new Error('quota-exceeded'))
        return
      }
      const job = {
        start: () => {
          signal.removeEventListener('abort', job.cancel)
          if (signal.aborted) {
            reject(new Error('cancelled'))
            this.advance()
            return
          }
          this.active++
          void Promise.resolve()
            .then(() => {
              if (signal.aborted) throw new Error('cancelled')
              return work()
            })
            .then(resolve, reject)
            .finally(() => {
              this.active--
              this.advance()
            })
        },
        cancel: () => {
          this.waiting = this.waiting.filter((item) => item !== job)
          signal.removeEventListener('abort', job.cancel)
          reject(new Error('cancelled'))
        }
      }
      if (this.active < this.concurrency) job.start()
      else {
        this.waiting.push(job)
        signal.addEventListener('abort', job.cancel, { once: true })
      }
    })
  }
  private advance() {
    if (this.active < this.concurrency) this.waiting.shift()?.start()
  }
}
