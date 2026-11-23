import { BoundedMap } from '@/lib/bounded-map'
import { getProfileFromEvent } from '@/lib/event-metadata'
import {
  COMMAND_DEFINITION_KIND,
  isPreferredNipCdCatalog,
  mergeNipCdCatalogEvents,
  parseNipCdCatalog,
  TNipCdCommand
} from '@/lib/nip-cd'
import { isValidPubkey } from '@/lib/pubkey'
import { getDefaultRelayUrls, mergeRelayUrls } from '@/lib/relay'
import { kinds } from 'nostr-tools'
import client from './client.service'
import indexedDb, { MAX_NIP_CD_CATALOGS, TNipCdCatalogRecord } from './indexed-db.service'

const DISCOVERY_RELAYS = ['wss://nos.lol/', 'wss://relay.primal.net/', 'wss://relay.ditto.pub/']
const CATALOG_TTL = 3 * 24 * 60 * 60_000
const CATALOG_RETENTION = 30 * 24 * 60 * 60_000
const RETRY_COOLDOWN = 60_000

type TLocalCatalog = TNipCdCatalogRecord & { commands: TNipCdCommand[] }
type TRefresh = {
  promise: Promise<boolean>
  querying: boolean
  onQuery: Set<() => void>
}

export class NipCdService {
  private catalogs = new BoundedMap<string, TLocalCatalog>({ maxSize: MAX_NIP_CD_CATALOGS })
  private pending = new Map<string, TRefresh>()
  private retryAfter = new BoundedMap<string, number>({ maxSize: MAX_NIP_CD_CATALOGS })
  private localLoad?: Promise<void>
  private hydrated = false

  private hydrate() {
    return this.localLoad ?? (this.hydrated ? Promise.resolve() : this.reloadCachedCatalogs())
  }

  /** Refresh the local snapshot once per menu session so other tabs' writes appear without network. */
  reloadCachedCatalogs(): Promise<void> {
    if (this.localLoad) return this.localLoad
    this.localLoad = indexedDb
      .getNipCdCatalogs()
      .then((records) => {
        this.hydrated = true
        const cutoff = Date.now() - CATALOG_RETENTION
        for (const record of records.sort((a, b) => a.checkedAt - b.checkedAt)) {
          if (record.checkedAt <= cutoff) continue
          const local = this.catalogs.get(record.executor)
          if (local && !isPreferredNipCdCatalog(record, local)) continue
          this.remember({
            ...record,
            events: mergeNipCdCatalogEvents(record.events, record.executor)
          })
        }
      })
      .catch(() => {
        // IndexedDB may be unavailable; previously read/queried catalogs remain usable.
        this.hydrated = true
      })
      .finally(() => {
        this.localLoad = undefined
      })
    return this.localLoad
  }

  private remember(record: TNipCdCatalogRecord) {
    this.catalogs.set(record.executor, {
      ...record,
      commands: parseNipCdCatalog(record.events)
    })
  }

  /** Both bare and qualified menus read immediately from the local catalog, never the network. */
  async getCachedCommands(executor?: string): Promise<TNipCdCommand[]> {
    await this.hydrate()
    const cutoff = Date.now() - CATALOG_RETENTION
    const selected = executor ? [this.catalogs.get(executor)] : [...this.catalogs.values()]
    return selected.flatMap((catalog) =>
      catalog && catalog.checkedAt > cutoff ? catalog.commands : []
    )
  }

  /** Local profile labels avoid linking a relay request to a bare-slash keystroke. */
  async getCachedExecutorNames(executors: string[]) {
    const names = new Map<string, string>()
    if (!executors.length) return names
    const events = await indexedDb
      .getManyReplaceableEvents(executors, kinds.Metadata)
      .catch(() => [])
    for (const event of events) {
      if (!event) continue
      const username = getProfileFromEvent(event).original_username
      if (username) names.set(event.pubkey, username)
    }
    return names
  }

  /** Start once for an explicitly selected executor. Stale menus remain usable during refresh. */
  refresh(executor: string, onQuery?: () => void): Promise<boolean> {
    if (!isValidPubkey(executor)) return Promise.resolve(false)
    const existing = this.pending.get(executor)
    if (existing) {
      if (onQuery) {
        if (existing.querying) onQuery()
        else existing.onQuery.add(onQuery)
      }
      return existing.promise
    }
    const listeners = new Set(onQuery ? [onQuery] : [])
    const pending: TRefresh = {
      querying: false,
      onQuery: listeners,
      promise: this.refreshIfStale(executor, () => {
        pending.querying = true
        for (const notify of listeners) notify()
        listeners.clear()
      }).finally(() => this.pending.delete(executor))
    }
    this.pending.set(executor, pending)
    return pending.promise
  }

  private async refreshIfStale(executor: string, onQuery: () => void) {
    await this.hydrate()
    const cached = this.catalogs.get(executor)
    const now = Date.now()
    if (
      (cached?.complete && cached.checkedAt + CATALOG_TTL > now) ||
      (this.retryAfter.get(executor) ?? 0) > now
    ) {
      return false
    }
    try {
      onQuery()
      const { write, originalRelays } = await client.fetchRelayList(executor)
      const fallback = mergeRelayUrls(getDefaultRelayUrls().slice(0, 5), DISCOVERY_RELAYS)
      const writes = [...new Set(write)]
      const configured =
        writes.length > 0 &&
        writes.every((url) =>
          originalRelays.some((relay) => relay.url === url && relay.scope !== 'read')
        )
      if (!configured && cached?.complete && cached.authorRelays) {
        this.retryAfter.set(executor, Date.now() + RETRY_COOLDOWN)
        return false
      }
      const sources = configured ? writes : mergeRelayUrls(writes.slice(0, 5), fallback)
      // Never filter by scope before resolving replacements. Read the complete
      // executor catalog, including definitions that moved to another kind.
      const filter = { kinds: [COMMAND_DEFINITION_KIND], authors: [executor] }
      const snapshot = await client.fetchEventSnapshot(sources, filter)
      let events = mergeNipCdCatalogEvents(snapshot.events, executor)
      if (!snapshot.complete) {
        // Partial results, timeouts and discovery replicas are not evidence
        // that a previously cached definition is absent.
        this.retryAfter.set(executor, Date.now() + RETRY_COOLDOWN)
        if (cached) return false
        const extra = fallback.filter((url) => !sources.includes(url))
        if (!events.length && extra.length) {
          const discovery = await client.fetchEventSnapshot(extra, filter)
          events = mergeNipCdCatalogEvents(discovery.events, executor)
        }
        if (!events.length) return false
      }
      const record = {
        executor,
        checkedAt: now,
        complete: snapshot.complete,
        authorRelays: configured,
        events
      }
      const persisted = await indexedDb.putNipCdCatalog(record).catch(() => record)
      this.remember(persisted)
      return true
    } catch {
      this.retryAfter.set(executor, Date.now() + RETRY_COOLDOWN)
      return false
    }
  }
}

export default new NipCdService()
