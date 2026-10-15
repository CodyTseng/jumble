import { validateEvent, verifiedSymbol, verifyEvent, type NostrEvent } from 'nostr-tools'

type Verifier = (event: NostrEvent) => boolean

let backend: Verifier = verifyEvent
let enabling: Promise<void> | undefined

/** Checks the event id and schnorr signature once; later calls reuse the cached result. */
export function verifySignature(event: NostrEvent): boolean {
  // WASM's hex decoder accepts short inputs and reuses scratch buffers. Keep
  // NIP-01 shape/length checks identical before either cryptographic backend,
  // including calls that do not pass through the bounded manifest parser.
  if (
    !event ||
    typeof event !== 'object' ||
    !validateEvent(event) ||
    typeof event.id !== 'string' ||
    !/^[a-f0-9]{64}$/.test(event.id) ||
    typeof event.sig !== 'string' ||
    !/^[a-f0-9]{128}$/.test(event.sig) ||
    !Number.isSafeInteger(event.kind) ||
    event.kind < 0 ||
    event.kind > 65535 ||
    !Number.isSafeInteger(event.created_at) ||
    event.created_at < 0
  )
    return false
  const cached = (event as { [verifiedSymbol]?: unknown })[verifiedSymbol]
  if (typeof cached === 'boolean') return cached
  const valid = backend(event)
  if (valid) event[verifiedSymbol] = true
  return valid
}

/**
 * Switches verification to libsecp256k1-WASM. Verification stays on the JS
 * implementation until the module has loaded, and remains there if it fails.
 */
export function enableWasmVerification() {
  enabling ??= import('nostr-wasm/gzipped')
    .then(({ initNostrWasm }) => initNostrWasm())
    .then((wasm) => {
      backend = (event) => {
        try {
          wasm.verifyEvent(event)
          return true
        } catch {
          return false
        }
      }
    })
    .catch((error: unknown) => {
      console.warn('WASM signature verification unavailable; using JavaScript verification.', {
        cause: error instanceof Error ? error.message : String(error)
      })
    })
  return enabling
}
