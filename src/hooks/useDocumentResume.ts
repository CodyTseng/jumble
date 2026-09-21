import { useEffect, useState } from 'react'

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

/**
 * Bumps when the document should soft-restart live feed subscriptions after
 * sleep / long backgrounding / bfcache restore / network return — without a
 * full page reload (#15).
 *
 * Deliberately does NOT fire on brief tab switches (see shouldResumeAfterHiddenDuration).
 */
export function useDocumentResume(): number {
  const [resumeCount, setResumeCount] = useState(0)

  useEffect(() => {
    if (typeof document === 'undefined') return

    let hiddenAt: number | null = document.hidden ? Date.now() : null
    let lastBumpAt = 0

    const bump = (_reason: DocumentResumeReason) => {
      const now = Date.now()
      // Coalesce visibility + online + resume that often arrive together on wake.
      if (now - lastBumpAt < 1_000) return
      lastBumpAt = now
      setResumeCount((n) => n + 1)
    }

    const onVisibility = () => {
      if (document.hidden) {
        hiddenAt = Date.now()
        return
      }
      const wasHiddenAt = hiddenAt
      hiddenAt = null
      if (shouldResumeAfterHiddenDuration(wasHiddenAt, Date.now())) {
        bump('visibility')
      }
    }

    const onResume = () => {
      // Page Lifecycle `resume` after OS freeze/sleep — fire even if visibility
      // never flipped (some lock-screen paths keep visibilityState=visible).
      bump('resume')
    }

    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) bump('pageshow')
    }

    const onOnline = () => bump('online')

    document.addEventListener('visibilitychange', onVisibility)
    // Chromium Page Lifecycle (typed loosely — not in all lib.dom versions)
    document.addEventListener('resume', onResume as EventListener)
    window.addEventListener('pageshow', onPageShow)
    window.addEventListener('online', onOnline)

    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      document.removeEventListener('resume', onResume as EventListener)
      window.removeEventListener('pageshow', onPageShow)
      window.removeEventListener('online', onOnline)
    }
  }, [])

  return resumeCount
}
