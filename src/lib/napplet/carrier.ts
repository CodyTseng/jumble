type Carrier = { frame: HTMLIFrameElement; send: (message: Record<string, unknown>) => void }

export function nappletCarrierUrl(
  base = import.meta.env.BASE_URL,
  location = window.location.href
) {
  // Electron bundles use a relative asset base, but SPA route segments are not asset directories.
  return new URL(`${base === './' ? '/' : base}napplet-host.html`, location).href
}

/** Only the static same-origin carrier has access to the shell; app code never does. */
export function getNappletCarrier(frame: HTMLIFrameElement, signal: AbortSignal) {
  return new Promise<Carrier & { messageTarget: Window }>((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timer)
      frame.removeEventListener('load', ready)
      signal.removeEventListener('abort', abort)
    }
    const abort = () => {
      cleanup()
      reject(new Error('Napplet session closed'))
    }
    const ready = () => {
      try {
        const target = frame.contentWindow as (Window & { jumbleNappletHost?: Carrier }) | null
        // A navigation can leave the old document observable until the new load commits.
        if (target?.location.href !== frame.src) return
        const carrier = target?.jumbleNappletHost
        if (!target || !carrier) return
        cleanup()
        resolve({ ...carrier, messageTarget: target })
      } catch (error) {
        cleanup()
        reject(error)
      }
    }
    const timer = setTimeout(() => {
      cleanup()
      reject(new Error('Napplet host did not load'))
    }, 15000)
    frame.addEventListener('load', ready)
    signal.addEventListener('abort', abort, { once: true })
    if (signal.aborted) abort()
    else ready()
  })
}
