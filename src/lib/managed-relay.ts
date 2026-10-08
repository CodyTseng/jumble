import { AbstractRelay, SendingOnClosedConnection } from 'nostr-tools/abstract-relay'
import { IRelay, TSubCloser, TSubHandlers } from '../types/relay-pool'
import type { RelayObserver } from './relay-observation'

const DEFAULT_CONNECTION_TIMEOUT = 10 * 1000
const RETRY_DELAYS_MS = [1_000, 2_000]
const MAX_CONNECTION_ATTEMPTS = 3

type LogicalSubscription = {
  filters: Parameters<AbstractRelay['subscribe']>[0]
  handlers: TSubHandlers
  physicalSub?: TSubCloser
  eosed: boolean
  readTimer?: ReturnType<typeof setTimeout>
}

/**
 * Owns one relay URL. Logical subscriptions survive WebSocket replacement;
 * their short-lived `physicalSub` counterparts do not.
 */
export class ManagedRelay implements IRelay {
  publishTimeout = DEFAULT_CONNECTION_TIMEOUT

  private connection?: AbstractRelay
  private connectPromise?: Promise<AbstractRelay>
  private connectAbort?: AbortController
  private generation = 0
  private subscriptions = new Set<LogicalSubscription>()
  private transientOperations = 0
  private connectionFailures = 0
  private retryTimer?: ReturnType<typeof setTimeout>
  private releaseTimer?: ReturnType<typeof setTimeout>
  private networkOnline = true

  constructor(
    readonly url: string,
    private readonly createConnection: () => AbstractRelay,
    private readonly assertConnectionAllowed: () => void,
    private readonly onIdle?: () => void,
    private readonly observe?: RelayObserver
  ) {}

  publish(
    event: Parameters<IRelay['publish']>[0],
    onstart?: (startedAt: number) => void
  ): Promise<unknown> {
    return this.withRelay(async (relay) => {
      relay.publishTimeout = this.publishTimeout
      try {
        onstart?.(Date.now())
        return await relay.publish(event)
      } catch (error) {
        if (isBrokenPublishConnection(error)) this.recycle()
        throw error
      }
    })
  }

  auth(signAuthEvent: Parameters<IRelay['auth']>[0]): Promise<unknown> {
    return this.withRelay((relay) => relay.auth(signAuthEvent))
  }

  subscribe(filters: Parameters<IRelay['subscribe']>[0], handlers: TSubHandlers): TSubCloser {
    this.clearReleaseTimer()
    const logical: LogicalSubscription = {
      filters: cloneFilters(filters),
      handlers,
      eosed: false
    }
    this.subscriptions.add(logical)

    if (this.connection?.connected) {
      this.attachSubscription(logical, this.connection)
    } else {
      this.connectForSubscriptions()
    }

    return {
      close: (reason?: string) => this.closeSubscription(logical, reason)
    }
  }

  setNetworkOnline(online: boolean) {
    if (this.networkOnline === online) return
    this.networkOnline = online
    this.clearRetryTimer()
    if (online) this.connectionFailures = 0
  }

  async checkHealth(): Promise<void> {
    if (!this.networkOnline) return
    // A publish/auth already exercises the socket. Replacing it here would
    // turn a harmless foreground recovery into a business-visible failure.
    if (this.transientOperations > 0) return
    if (this.subscriptions.size === 0) {
      this.releaseIfUnused()
      return
    }

    // Browsers can keep a half-open WebSocket after a long suspension. There
    // is no reliable readyState check for that condition, so rebuild demanded
    // connections and recreate their physical REQs.
    this.closeConnection()
    await this.connect()
  }

  private recycle() {
    this.closeConnection()
    this.connectForSubscriptions()
  }

  shutdown(reason: string) {
    this.clearRetryTimer()
    this.clearReleaseTimer()
    const subscriptions = Array.from(this.subscriptions)
    for (const logical of subscriptions) {
      const physicalSub = logical.physicalSub
      this.removeSubscription(logical)
      physicalSub?.close(reason)
      logical.handlers.onclose?.(reason)
    }
    this.closeConnection()
  }

  get connected(): boolean {
    return this.connection?.connected ?? false
  }

  private async withRelay<T>(operation: (relay: AbstractRelay) => Promise<T>): Promise<T> {
    this.transientOperations++
    this.clearReleaseTimer()
    try {
      const relay = await this.connect()
      return await operation(relay)
    } finally {
      this.transientOperations--
      this.scheduleReleaseIfUnused()
    }
  }

  private connect(): Promise<AbstractRelay> {
    if (!this.networkOnline) return Promise.reject(new Error('network is offline'))
    if (this.connection?.connected) return Promise.resolve(this.connection)
    if (this.connectPromise) return this.connectPromise

    this.clearRetryTimer()
    this.clearReleaseTimer()
    const generation = ++this.generation
    const abort = new AbortController()
    this.connectAbort = abort

    const attempt = (async () => {
      let relay: AbstractRelay | undefined
      let established = false
      let startedAt: number | undefined
      try {
        this.assertConnectionAllowed()
        const nextRelay = this.createConnection()
        relay = nextRelay
        this.connection = nextRelay
        nextRelay.onclose = () => this.handleConnectionClose(nextRelay, generation, established)
        startedAt = Date.now()
        await nextRelay.connect({ timeout: DEFAULT_CONNECTION_TIMEOUT, abort: abort.signal })

        if (this.generation !== generation || this.connection !== nextRelay) {
          nextRelay.onclose = null
          nextRelay.close()
          throw new Error('stale relay connection')
        }

        established = true
        this.observe?.({
          type: 'connection',
          url: this.url,
          at: startedAt,
          duration: Date.now() - startedAt
        })
        this.connectionFailures = 0
        this.attachSubscriptions(nextRelay)
        return nextRelay
      } catch (error) {
        if (this.generation === generation) {
          if (relay) relay.onclose = null
          if (this.connection === relay) this.connection = undefined
          if (
            startedAt !== undefined &&
            !established &&
            !abort.signal.aborted &&
            this.networkOnline
          ) {
            const duration = Date.now() - startedAt
            const reason = error instanceof Error ? error.message : String(error)
            // A delayed timer after system sleep is not a relay failure.
            if (!reason.includes('timed out') || duration < DEFAULT_CONNECTION_TIMEOUT * 1.5) {
              this.observe?.({ type: 'connection', url: this.url, at: startedAt, duration, reason })
            }
          }
          this.recordConnectionFailure(error)
        }
        throw error
      }
    })()

    // Promise cleanup runs in a microtask even when validation fails
    // synchronously, so concurrent callers still observe the same attempt.
    const tracked = attempt.finally(() => {
      if (this.generation === generation && this.connectPromise === tracked) {
        this.connectPromise = undefined
        this.connectAbort = undefined
      }
    })
    this.connectPromise = tracked
    return tracked
  }

  private handleConnectionClose(relay: AbstractRelay, generation: number, established: boolean) {
    if (this.generation !== generation || this.connection !== relay) return
    this.connection = undefined
    this.connectPromise = undefined
    this.connectAbort = undefined

    // A socket that opened is recoverable transport loss. Initial connection
    // failures are counted by connect() instead.
    if (established) this.scheduleRetry(true)
  }

  private attachSubscriptions(relay: AbstractRelay) {
    for (const logical of this.subscriptions) {
      this.attachSubscription(logical, relay)
    }
  }

  private attachSubscription(logical: LogicalSubscription, relay: AbstractRelay) {
    if (!this.subscriptions.has(logical) || logical.physicalSub) return

    // Register before nostr-tools' synthetic EOSE timer, so an actual EOSE
    // clears this deadline while a timeout can be reported separately.
    const startedAt = Date.now()
    logical.handlers.onrequest?.(startedAt)
    if (!logical.eosed) {
      const timeout = logical.handlers.eoseTimeout ?? DEFAULT_CONNECTION_TIMEOUT
      logical.readTimer = setTimeout(() => {
        logical.readTimer = undefined
        if (!this.subscriptions.has(logical) || logical.eosed) return
        if (this.networkOnline && Date.now() - startedAt < timeout * 1.5) {
          logical.handlers.ontimeout?.()
        }
        this.notifyEose(logical)
      }, timeout)
    }

    const physicalSub = relay.subscribe(cloneFilters(logical.filters), {
      ...logical.handlers,
      eoseTimeout: logical.handlers.eoseTimeout ?? DEFAULT_CONNECTION_TIMEOUT,
      // Observe verified, matching data before application deduplication.
      alreadyHaveEvent: logical.handlers.ondata ? undefined : logical.handlers.alreadyHaveEvent,
      onevent: (event) => {
        if (logical.handlers.ondata) {
          logical.handlers.ondata(Date.now())
          if (logical.handlers.alreadyHaveEvent?.(event.id)) return
        }
        logical.handlers.onevent?.(event)
      },
      receivedEvent: logical.handlers.receivedEvent
        ? (_relay, id) => logical.handlers.receivedEvent?.(this, id)
        : undefined,
      oneose: () => {
        this.clearReadTimer(logical)
        this.notifyEose(logical)
      },
      onclose: (reason) => {
        this.clearReadTimer(logical)
        if (logical.physicalSub === physicalSub) logical.physicalSub = undefined
        if (!this.subscriptions.has(logical)) return
        // AbstractRelay closes physical subscriptions when its socket drops.
        // Keep the logical REQ registered so the next connection can restore it.
        if (reason.startsWith('relay connection')) return

        this.removeSubscription(logical)
        logical.handlers.onclose?.(reason)
        // Give auth-required and other terminal handlers one task to register
        // their replacement REQ before releasing the authenticated socket.
        this.scheduleReleaseIfUnused()
      }
    })
    logical.physicalSub = physicalSub
  }

  private closeSubscription(logical: LogicalSubscription, reason?: string) {
    if (!this.subscriptions.has(logical)) return
    const physicalSub = logical.physicalSub
    this.removeSubscription(logical)
    physicalSub?.close(reason)
    this.releaseIfUnused()
  }

  private notifyEose(logical: LogicalSubscription) {
    if (!this.subscriptions.has(logical) || logical.eosed) return
    // EOSE belongs to the logical REQ. A replacement physical REQ may emit
    // EOSE again after reconnect, but callers must observe it only once.
    logical.eosed = true
    logical.handlers.oneose?.()
  }

  private removeSubscription(logical: LogicalSubscription) {
    if (!this.subscriptions.delete(logical)) return
    this.clearReadTimer(logical)
    logical.physicalSub = undefined
    if (this.subscriptions.size === 0) this.clearRetryTimer()
  }

  private connectForSubscriptions() {
    if (!this.networkOnline || this.subscriptions.size === 0) return
    void this.connect().catch(() => {
      // connect() accounts for the failure and schedules the next attempt.
    })
  }

  private recordConnectionFailure(error: unknown) {
    if (!this.networkOnline || this.subscriptions.size === 0) return

    this.connectionFailures++
    const reason = error instanceof Error ? error.message : String(error)
    if (this.connectionFailures >= MAX_CONNECTION_ATTEMPTS) {
      this.failSubscriptions(
        `relay connection unavailable after ${this.connectionFailures} attempts: ${reason}`
      )
      return
    }

    this.scheduleRetry()
  }

  private scheduleRetry(immediate = false) {
    if (!this.networkOnline || this.subscriptions.size === 0 || this.retryTimer) return

    const backoffIndex = Math.max(0, this.connectionFailures - 1)
    const delay = immediate
      ? 0
      : RETRY_DELAYS_MS[Math.min(backoffIndex, RETRY_DELAYS_MS.length - 1)]
    this.retryTimer = setTimeout(() => {
      this.retryTimer = undefined
      this.connectForSubscriptions()
    }, delay)
  }

  private failSubscriptions(reason: string) {
    const subscriptions = Array.from(this.subscriptions)
    for (const logical of subscriptions) {
      const physicalSub = logical.physicalSub
      // ClientService aggregates EOSE across relays. Settle this logical REQ
      // before onclose so one unavailable relay cannot block that aggregate.
      this.notifyEose(logical)
      this.removeSubscription(logical)
      physicalSub?.close(reason)
      logical.handlers.onclose?.(reason)
    }
    this.clearRetryTimer()
    this.scheduleReleaseIfUnused()
  }

  private closeConnection() {
    this.clearRetryTimer()
    const relay = this.connection
    const abort = this.connectAbort

    this.generation++
    this.connection = undefined
    this.connectPromise = undefined
    this.connectAbort = undefined
    abort?.abort('relay connection replaced')

    if (relay) {
      relay.onclose = null
      relay.close()
    }
  }

  private scheduleReleaseIfUnused() {
    if (this.releaseTimer) return
    // Terminal handlers (notably auth-required) get one task to start auth or
    // register a replacement REQ before the otherwise-idle socket is released.
    this.releaseTimer = setTimeout(() => {
      this.releaseTimer = undefined
      this.releaseIfUnused()
    }, 0)
  }

  private releaseIfUnused() {
    this.clearReleaseTimer()
    if (this.subscriptions.size > 0 || this.transientOperations > 0) return
    this.closeConnection()
    this.onIdle?.()
  }

  private clearReadTimer(logical: LogicalSubscription) {
    if (logical.readTimer) clearTimeout(logical.readTimer)
    logical.readTimer = undefined
  }

  private clearRetryTimer() {
    if (this.retryTimer) clearTimeout(this.retryTimer)
    this.retryTimer = undefined
  }

  private clearReleaseTimer() {
    if (this.releaseTimer) clearTimeout(this.releaseTimer)
    this.releaseTimer = undefined
  }
}

function cloneFilters(filters: Parameters<AbstractRelay['subscribe']>[0]) {
  return filters.map((filter) =>
    Object.fromEntries(
      Object.entries(filter).map(([key, value]) => [key, Array.isArray(value) ? [...value] : value])
    )
  ) as Parameters<AbstractRelay['subscribe']>[0]
}

function isBrokenPublishConnection(error: unknown): boolean {
  if (error instanceof SendingOnClosedConnection) return true

  // nostr-tools currently rejects a publish timeout with a plain Error rather
  // than an exported error type, so this case cannot use instanceof.
  return error instanceof Error && error.message === 'publish timed out'
}
