import { useSyncExternalStore } from 'react'

/** Hidden this long before visible → treat as sleep / long absence (not tab flick). */
export const DOCUMENT_RESUME_HIDDEN_MS = 5 * 60 * 1000

export type DocumentResumeReason = 'visibility' | 'resume' | 'pageshow' | 'online'

/**
 * Pure helper for tests: should a hidden→visible transition count as a resume?
 * Short tab switches must NOT resume (CodyTseng rejected that UX in #748).
 */
export function shouldResumeAfterHiddenDuration(
  hiddenAt: number | null,
  now: number,
  thresholdMs: number = DOCUMENT_RESUME_HIDDEN_MS
): boolean {
  if (hiddenAt == null) return false
  return now - hiddenAt >= thresholdMs
}

type Listener = () => void

let liveAllowed = true
const liveListeners = new Set<Listener>()
let lifecycleBound = false
let hiddenAt: number | null = null
let disableTimer: ReturnType<typeof setTimeout> | undefined
let lastPulseAt = 0

function emitLive() {
  for (const listener of liveListeners) listener()
}

function setLiveAllowed(value: boolean) {
  if (liveAllowed === value) return
  liveAllowed = value
  emitLive()
}

function clearDisableTimer() {
  if (disableTimer !== undefined) {
    clearTimeout(disableTimer)
    disableTimer = undefined
  }
}

function pulseResubscribe(_reason: DocumentResumeReason) {
  const now = Date.now()
  if (now - lastPulseAt < 1_000) return
  lastPulseAt = now
  setLiveAllowed(false)
  queueMicrotask(() => setLiveAllowed(true))
}

function onVisibility() {
  if (typeof document === 'undefined') return
  if (document.hidden) {
    hiddenAt = Date.now()
    clearDisableTimer()
    disableTimer = setTimeout(() => {
      setLiveAllowed(false)
    }, DOCUMENT_RESUME_HIDDEN_MS)
    return
  }

  clearDisableTimer()
  const wasHiddenAt = hiddenAt
  hiddenAt = null
  const hiddenLongEnough = shouldResumeAfterHiddenDuration(wasHiddenAt, Date.now())

  if (hiddenLongEnough || !liveAllowed) {
    pulseResubscribe('visibility')
  } else {
    setLiveAllowed(true)
  }
}

function onResume() {
  pulseResubscribe('resume')
}

function onPageShow(event: PageTransitionEvent) {
  if (event.persisted) pulseResubscribe('pageshow')
}

function onOnline() {
  pulseResubscribe('online')
}

function ensureLifecycleBound() {
  if (lifecycleBound || typeof document === 'undefined') return
  lifecycleBound = true
  hiddenAt = document.hidden ? Date.now() : null
  document.addEventListener('visibilitychange', onVisibility)
  document.addEventListener('resume', onResume as EventListener)
  window.addEventListener('pageshow', onPageShow)
  window.addEventListener('online', onOnline)
}

function subscribeLive(listener: Listener) {
  ensureLifecycleBound()
  liveListeners.add(listener)
  return () => {
    liveListeners.delete(listener)
  }
}

function getLiveSnapshot() {
  return liveAllowed
}

function getLiveServerSnapshot() {
  return true
}

/**
 * Shared gate for live feed subscriptions. Stays true across brief tab
 * switches; after long hide / sleep resume / bfcache / online it pulses
 * false→true so `usePageActive()` consumers soft-resubscribe (#15).
 */
export function useLiveSubscriptionGate(): boolean {
  return useSyncExternalStore(subscribeLive, getLiveSnapshot, getLiveServerSnapshot)
}

/**
 * Increments-style API kept for tests / direct callers: derived from gate pulses.
 * Prefer useLiveSubscriptionGate for subscription effects.
 */
export function useDocumentResume(): number {
  const allowed = useLiveSubscriptionGate()
  // Expose a changing number when allowed flips back to true after a pulse.
  // Consumers that only need the boolean should use useLiveSubscriptionGate.
  return allowed ? 1 : 0
}
