/** Observe a waiting service worker without reloading other tabs or their editors. */
export function watchWebUpdate(
  onReady: () => void,
  onError: (error: unknown) => void,
  reload = () => window.location.reload()
) {
  let disposed = false
  let registration: ServiceWorkerRegistration | undefined
  let updateReady = false
  let lastCheck = Date.now()
  const cleanups: (() => void)[] = []
  const observed = new WeakSet<ServiceWorker>()

  const ready = () => {
    updateReady = true
    if (!disposed) onReady()
  }
  const observe = (worker: ServiceWorker | null) => {
    if (!worker || observed.has(worker)) return
    observed.add(worker)
    const changed = () => {
      // An initial install is not an update. A waiting worker is safe to offer
      // only after its assets have finished installing.
      if (worker.state === 'installed' && navigator.serviceWorker.controller) ready()
    }
    worker.addEventListener('statechange', changed)
    cleanups.push(() => worker.removeEventListener('statechange', changed))
    changed()
  }
  const check = () => {
    if (document.visibilityState !== 'visible' || !navigator.onLine) return
    if (!registration || Date.now() - lastCheck < 60 * 60 * 1000) return
    lastCheck = Date.now()
    void registration.update().catch(onError)
  }

  void navigator.serviceWorker
    .register(`${import.meta.env.BASE_URL}sw.js`, { updateViaCache: 'none' })
    .then((value) => {
      if (disposed) return
      registration = value
      if (value.waiting && navigator.serviceWorker.controller) ready()
      const found = () => observe(value.installing)
      value.addEventListener('updatefound', found)
      cleanups.push(() => value.removeEventListener('updatefound', found))
      found()
    })
    .catch((error) => {
      if (!disposed) onError(error)
    })

  const interval = window.setInterval(check, 60 * 60 * 1000)
  document.addEventListener('visibilitychange', check)
  window.addEventListener('online', check)

  return {
    async apply() {
      if (disposed || !updateReady || !registration) return
      const waiting = registration.waiting
      // Another tab may already have activated the update. Only the tab whose
      // user explicitly accepts should reload; never listen for controllerchange.
      if (!waiting) {
        reload()
        return
      }
      await new Promise<void>((resolve, reject) => {
        let finished = false
        const finish = (error?: Error) => {
          if (finished) return
          finished = true
          clearTimeout(timeout)
          waiting.removeEventListener('statechange', changed)
          if (error) reject(error)
          else resolve()
        }
        const changed = () => {
          if (waiting.state === 'activated') finish()
          else if (waiting.state === 'redundant') finish(new Error('Update became unavailable'))
        }
        const timeout = setTimeout(() => finish(new Error('Update timed out')), 15000)
        waiting.addEventListener('statechange', changed)
        cleanups.push(() => finish())
        try {
          waiting.postMessage({ type: 'SKIP_WAITING' })
          changed()
        } catch (error) {
          finish(error instanceof Error ? error : new Error(String(error)))
        }
      })
      if (!disposed) reload()
    },
    dispose() {
      disposed = true
      clearInterval(interval)
      document.removeEventListener('visibilitychange', check)
      window.removeEventListener('online', check)
      cleanups.forEach((cleanup) => cleanup())
    }
  }
}
