import type { Event as NEvent } from 'nostr-tools'
import { SendingOnClosedConnection } from 'nostr-tools/abstract-relay'
import type { IRelay } from '@/types/relay-pool'
import { isAuthRequiredReason, isTransportFailure, RelayObserver } from './relay-observation'

/** One logical publish, including at most one authentication retry. */
export async function publishRelayEvent(
  relay: IRelay,
  event: NEvent,
  observe: RelayObserver,
  authenticate?: () => Promise<void>
) {
  let startedAt: number | undefined
  let attemptAt: number | undefined
  let hasAuthed = false
  const reasonOf = (error: unknown) => (error instanceof Error ? error.message : String(error))
  const failure = (error: unknown) => {
    if (startedAt === undefined) return // Connection errors have their own observations.
    const reason = reasonOf(error)
    if (!hasAuthed && isAuthRequiredReason(reason)) return
    if (reason.includes('publish timed out')) {
      if (
        attemptAt !== undefined &&
        Date.now() - attemptAt < relay.publishTimeout * 1.5 &&
        (typeof navigator === 'undefined' || navigator.onLine !== false)
      ) {
        observe({ type: 'write-timeout', url: relay.url, at: startedAt })
      }
    } else if (!(error instanceof SendingOnClosedConnection) && !isTransportFailure(reason)) {
      observe({ type: 'write-rejection', url: relay.url, at: startedAt, reason })
    }
  }

  while (true) {
    try {
      await relay.publish(event, (at) => {
        startedAt ??= at
        attemptAt = at
      })
      if (startedAt !== undefined)
        observe({
          type: 'write-time',
          url: relay.url,
          at: startedAt,
          duration: Date.now() - startedAt
        })
      return
    } catch (error) {
      if (!hasAuthed && isAuthRequiredReason(reasonOf(error)) && authenticate) {
        await authenticate()
        hasAuthed = true
      } else {
        failure(error)
        throw error
      }
    }
  }
}
