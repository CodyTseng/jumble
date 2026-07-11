import type { Event, Nostr, VerifiedEvent } from 'nostr-tools'
import { verifyEvent as verifyEventPure } from 'nostr-tools/pure'
import { setNostrWasm, verifyEvent as verifyEventWasm } from 'nostr-tools/wasm'
import { initNostrWasm } from 'nostr-wasm'

let initPromise: Promise<boolean> | undefined
let wasmVerifier: Nostr['verifyEvent'] | undefined

/**
 * Initialize the faster WASM verifier once. Callers can continue verifying
 * events while this is pending (or if it fails) via the pure-JS fallback.
 */
export function initializeNostrVerifier(): Promise<boolean> {
  if (!initPromise) {
    initPromise = initNostrWasm()
      .then((nostrWasm) => {
        setNostrWasm(nostrWasm)
        wasmVerifier = verifyEventWasm
        return true
      })
      .catch((err) => {
        console.warn('[nostr-verifier] WASM initialization failed; using pure JS', err)
        return false
      })
  }

  return initPromise
}

export function verifyEvent(event: Event): event is VerifiedEvent {
  return wasmVerifier ? wasmVerifier(event) : verifyEventPure(event)
}
