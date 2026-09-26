type RelayPoolLifecycleTarget = {
  setNetworkOnline: (online: boolean) => void | Promise<void>
  checkRelays: () => Promise<void>
}

type PageGlobal = typeof globalThis & {
  navigator?: { onLine?: boolean }
  addEventListener?: (type: string, listener: (event?: Event) => void) => void
  removeEventListener?: (type: string, listener: (event?: Event) => void) => void
  document?: {
    visibilityState?: string
    addEventListener: (type: string, listener: (event?: Event) => void) => void
    removeEventListener?: (type: string, listener: (event?: Event) => void) => void
  }
}

/**
 * Keeps a renderer-owned relay pool in sync with browser lifecycle signals.
 * `globalThis` capability checks keep this module safe when SmartPool runs in
 * Electron's main process, where DOM globals do not exist.
 *
 * Also recovers after OS sleep via Page Lifecycle `resume` and bfcache
 * `pageshow` — visibilitychange alone misses some lock-screen wake paths (#15).
 */
export function observeRelayPoolLifecycle(target: RelayPoolLifecycleTarget) {
  const page = globalThis as PageGlobal
  const initialOnline = page.navigator?.onLine

  if (typeof initialOnline === 'boolean' && page.addEventListener) {
    runLifecycleTask(() => target.setNetworkOnline(initialOnline))
    page.addEventListener('online', () => {
      // Preserve ordering for Electron IPC: main must be marked online before
      // it is asked to rebuild connections.
      runLifecycleTask(async () => {
        await target.setNetworkOnline(true)
        await target.checkRelays()
      })
    })
    page.addEventListener('offline', () => {
      runLifecycleTask(() => target.setNetworkOnline(false))
    })
    page.addEventListener('pageshow', (event) => {
      const persisted = Boolean((event as PageTransitionEvent | undefined)?.persisted)
      if (persisted) {
        runLifecycleTask(() => target.checkRelays())
      }
    })
  }

  page.document?.addEventListener('visibilitychange', () => {
    if (page.document?.visibilityState === 'visible') {
      runLifecycleTask(() => target.checkRelays())
    }
  })

  // Page Lifecycle API — fires after freeze/sleep even when visibilityState
  // stayed "visible" across a screen lock on some platforms.
  page.document?.addEventListener('resume', () => {
    runLifecycleTask(() => target.checkRelays())
  })
}

function runLifecycleTask(task: () => void | Promise<void>) {
  try {
    void Promise.resolve(task()).catch(() => {
      // Lifecycle recovery is best-effort. Active REQs report terminal
      // connection failures through their normal onclose handlers.
    })
  } catch {
    // Keep browser lifecycle events from surfacing as uncaught exceptions.
  }
}
