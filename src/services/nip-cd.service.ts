import { BoundedMap } from '@/lib/bounded-map'
import { getProfileFromEvent } from '@/lib/event-metadata'
import {
  COMMAND_DEFINITION_KIND,
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
const MAX_PEER_RELAYS = 5

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
          if (
            local?.checkedAt === record.checkedAt &&
            local.events.length === record.events.length &&
            local.events.every((event, index) => event.id === record.events[index].id)
          )
            continue
          // A write can fail while the in-memory refresh still succeeded.
          // Merge disk evidence without discarding a newer local definition or withdrawal.
          const events = mergeNipCdCatalogEvents(
            [...(local?.events ?? []), ...record.events],
            record.executor
          )
          this.remember({
            ...record,
            checkedAt: Math.max(local?.checkedAt ?? 0, record.checkedAt),
            events
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
      commands: parseNipCdCatalog(record.events, record.executor)
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
      (cached && cached.checkedAt + CATALOG_TTL > now) ||
      (this.retryAfter.get(executor) ?? 0) > now
    ) {
      return false
    }
    try {
      onQuery()
      const { write } = await client.fetchRelayList(executor)
      const relays = mergeRelayUrls(
        write.slice(0, MAX_PEER_RELAYS),
        getDefaultRelayUrls().slice(0, MAX_PEER_RELAYS),
        DISCOVERY_RELAYS
      )
      // Never filter by #s before resolving replacements: a DM-only version can
      // overwrite a public declaration. Store both public kinds in one catalog.
      const observed = mergeNipCdCatalogEvents(
        await client.fetchEvents(relays, [
          { kinds: [COMMAND_DEFINITION_KIND], authors: [executor], limit: 256 },
          { kinds: [kinds.EventDeletion], authors: [executor], limit: 256 }
        ]),
        executor
      )
      if (!observed.length) throw new Error('No verified command catalog events received')
      // fetchEvents can settle on relay failures as well as EOSE. Absence is
      // not a withdrawal; only merge newer signed replacements/deletions.
      const events = mergeNipCdCatalogEvents([...(cached?.events ?? []), ...observed], executor)
      const record = { executor, checkedAt: Date.now(), events }
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
