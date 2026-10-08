import type { Filter, Event as NEvent } from 'nostr-tools'
import type { IRelay, IRelayPool, TSubCloser } from '@/types/relay-pool'
import { isAuthRequiredReason, isTransportFailure, type RelayObserver } from './relay-observation'

export const RELAY_SUBSCRIPTION_EOSE_TIMEOUT = 10_000

type RelaySubscriptionHandlers = {
  observe?: RelayObserver
  onevent?: (event: NEvent) => void
  oneose?: (eosed: boolean) => void
  onclose?: (url: string, reason: string) => void
  onAllClose?: (reasons: string[]) => void
  startLogin?: () => void
  receivedEvent?: (relay: IRelay, id: string) => void
  alreadyHaveEvent?: (id: string) => boolean
  getAuthenticator?: () => ((relay: IRelay) => Promise<void>) | undefined
}

type RelayState = {
  startedAt?: number
  firstEvent: boolean
  readTimedOut: boolean
  readCompleted: boolean
  authPending: boolean
  eosed: boolean
  closed: boolean
  hasAuthed: boolean
  eoseTimer?: ReturnType<typeof setTimeout>
}

/**
 * Coordinates one logical subscription across multiple relays.
 *
 * Every relay must settle the initial read exactly once. Connection retries are
 * allowed to continue for live subscriptions, but they must not extend the UI's
 * initial-loading state indefinitely.
 */
export function subscribeRelays(
  pool: IRelayPool,
  urls: string[],
  filters: Filter[],
  handlers: RelaySubscriptionHandlers
): TSubCloser {
  const relays = Array.from(new Set(urls))
  const startedCount = relays.length
  const subPromises: Promise<TSubCloser>[] = []
  const states = new Map<string, RelayState>()
  const closeReasons: string[] = []
  let eosedCount = 0
  let closedCount = 0
  let closedByCaller = false

  const settleEose = (state: RelayState) => {
    if (closedByCaller || state.eosed) return
    state.eosed = true
    if (state.eoseTimer) clearTimeout(state.eoseTimer)
    state.eoseTimer = undefined
    eosedCount++
    handlers.oneose?.(eosedCount >= startedCount)
  }

  const settleClose = (url: string, state: RelayState, reason: string) => {
    if (closedByCaller || state.closed) return
    state.closed = true
    closedCount++
    closeReasons.push(reason)
    handlers.onclose?.(url, reason)
    if (closedCount >= startedCount) handlers.onAllClose?.(closeReasons)
  }

  const recordTimeout = (url: string, state: RelayState) => {
    if (
      closedByCaller ||
      state.closed ||
      state.readCompleted ||
      state.readTimedOut ||
      state.authPending ||
      state.startedAt === undefined
    )
      return
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return
    state.readTimedOut = true
    handlers.observe?.({
      type: 'read-timeout',
      url,
      at: state.startedAt,
      phase: state.firstEvent ? 'completion' : 'first-event'
    })
  }

  const startSub = async (url: string, state: RelayState): Promise<TSubCloser> => {
    let relay: IRelay
    try {
      relay = await pool.ensureRelay(url)
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error)
      settleEose(state)
      settleClose(url, state, reason)
      return { close: () => {} }
    }

    if (closedByCaller) return { close: () => {} }

    try {
      return relay.subscribe(filters, {
        onrequest: (at) => {
          state.startedAt ??= at
        },
        ontimeout: () => recordTimeout(url, state),
        ondata: (receivedAt = Date.now()) => {
          if (
            !closedByCaller &&
            !state.closed &&
            !state.firstEvent &&
            !state.readCompleted &&
            !state.readTimedOut &&
            state.startedAt !== undefined
          ) {
            state.firstEvent = true
            handlers.observe?.({
              type: 'read-time',
              url,
              at: state.startedAt,
              duration: receivedAt - state.startedAt
            })
          }
        },
        receivedEvent: handlers.receivedEvent,
        alreadyHaveEvent: handlers.alreadyHaveEvent,
        onevent: handlers.onevent,
        oneose: () => {
          state.readCompleted = true
          settleEose(state)
        },
        onclose: (reason: string) => {
          if (closedByCaller || state.closed || state.authPending) return

          if (isAuthRequiredReason(reason) && !state.hasAuthed) {
            const authenticate = handlers.getAuthenticator?.()
            if (authenticate) {
              state.authPending = true
              void authenticate(relay)
                .then(() => {
                  state.authPending = false
                  state.hasAuthed = true
                  if (!closedByCaller) subPromises.push(startSub(url, state))
                })
                .catch(() => {
                  state.authPending = false
                  settleEose(state)
                  settleClose(url, state, reason)
                })
              return
            }

            state.authPending = true
            if (handlers.startLogin) {
              handlers.startLogin()
              return
            }
          }

          if (!isAuthRequiredReason(reason) || state.hasAuthed) {
            if (!isTransportFailure(reason))
              handlers.observe?.({
                type: 'read-rejection',
                url,
                at: state.startedAt ?? Date.now(),
                reason
              })
          }

          // A relay that terminates its REQ cannot emit EOSE afterward. Count
          // the terminal close as completion so mixed EOSE/CLOSED outcomes do
          // not leave the aggregate request pending forever.
          settleEose(state)
          settleClose(url, state, reason)
        },
        eoseTimeout: RELAY_SUBSCRIPTION_EOSE_TIMEOUT
      })
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error)
      settleEose(state)
      settleClose(url, state, reason)
      return { close: () => {} }
    }
  }

  for (const url of relays) {
    const state: RelayState = {
      eosed: false,
      closed: false,
      hasAuthed: false,
      firstEvent: false,
      readTimedOut: false,
      readCompleted: false,
      authPending: false
    }
    const scheduledAt = Date.now()
    state.eoseTimer = setTimeout(() => {
      if (Date.now() - scheduledAt < RELAY_SUBSCRIPTION_EOSE_TIMEOUT * 1.5)
        recordTimeout(url, state)
      settleEose(state)
    }, RELAY_SUBSCRIPTION_EOSE_TIMEOUT)
    states.set(url, state)
    subPromises.push(startSub(url, state))
  }

  // Empty relay lists are valid after filtering. Settle asynchronously so a
  // caller can store the returned closer before its EOSE callback runs.
  if (startedCount === 0) {
    queueMicrotask(() => {
      if (!closedByCaller) handlers.oneose?.(true)
    })
  }

  return {
    close: (reason?: string) => {
      if (closedByCaller) return
      closedByCaller = true
      for (const state of states.values()) {
        if (state.eoseTimer) clearTimeout(state.eoseTimer)
        state.eoseTimer = undefined
      }
      for (const subPromise of subPromises) {
        void subPromise.then((sub) => sub.close(reason)).catch((error) => console.error(error))
      }
    }
  }
}
