import { BoundedMap } from '@/lib/bounded-map'
import { getProfileFromEvent } from '@/lib/event-metadata'
import {
  COMMAND_DEFINITION_KIND,
  getNipCdCommandAddress,
  getNipCdCommandCoordinate,
  isPreferredNipCdCatalog,
  matchesNipCdScope,
  mergeNipCdCatalogEvents,
  parseNipCdCatalog,
  parseNipCdDefinition,
  TNipCdCommand,
  TNipCdCommandReference,
  TNipCdContext
} from '@/lib/nip-cd'
import { isValidPubkey } from '@/lib/pubkey'
import { kinds } from 'nostr-tools'
import client from './client.service'
import indexedDb, { MAX_NIP_CD_CATALOGS, TNipCdCatalogRecord } from './indexed-db.service'

const CATALOG_TTL = 24 * 60 * 60_000
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
        for (const record of records.sort((a, b) => a.checkedAt - b.checkedAt)) {
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
    if (executor) return this.catalogs.get(executor)?.commands ?? []
    return [...this.catalogs.values()].flatMap((catalog) => catalog.commands)
  }

  async getCachedDefinitionEvents(executor: string) {
    await this.hydrate()
    return (
      this.catalogs.get(executor)?.events.filter((event) => !!parseNipCdDefinition(event)) ?? []
    )
  }

  async fetchInstalledDefinition(reference: TNipCdCommandReference) {
    const isDefinition = (event: Parameters<typeof parseNipCdDefinition>[0]) => {
      const definition = parseNipCdDefinition(event)
      return definition && getNipCdCommandCoordinate(definition) === reference.coordinate
    }
    const getCached = () => this.catalogs.get(reference.executor)?.events.find(isDefinition)

    await this.hydrate()
    const cached = getCached()
    if (cached) return cached
    const fetched = await client
      .fetchEvent(getNipCdCommandAddress(reference))
      .catch(() => undefined)
    if (
      fetched &&
      isDefinition(fetched) &&
      mergeNipCdCatalogEvents([fetched], reference.executor).length
    ) {
      return fetched
    }

    await this.refresh(reference.executor)
    return getCached()
  }

  async resolveCommandDefinition(executor: string, trigger: string, context: TNipCdContext) {
    await this.hydrate()
    const findDefinition = () => {
      const catalog = this.catalogs.get(executor)
      if (!catalog) return
      const commands = catalog.commands.filter(({ command }) => command === trigger)
      const matching =
        commands.length > 1
          ? commands.filter((command) =>
              matchesNipCdScope(
                { ...command, scopes: command.scopes.filter(({ group }) => group !== 'relay') },
                context
              )
            )
          : commands
      if (matching.length !== 1) return
      const { id } = matching[0]
      return catalog.events.find(
        (event) => (event.tags.find(([name]) => name === 'd')?.[1] ?? '') === id
      )
    }

    const cached = findDefinition()
    if (cached) return cached
    await this.refresh(executor, undefined, true)
    return findDefinition()
  }

  /** Read executor profiles locally so the command menu does not query relays for them. */
  async getCachedExecutorProfiles(executors: string[]) {
    const profiles = new Map<string, { name?: string; avatar?: string }>()
    if (!executors.length) return profiles
    const events = await indexedDb
      .getManyReplaceableEvents(executors, kinds.Metadata)
      .catch(() => [])
    for (const event of events) {
      if (!event) continue
      const { original_username: name, avatar } = getProfileFromEvent(event)
      profiles.set(event.pubkey, { name, avatar: typeof avatar === 'string' ? avatar : undefined })
    }
    return profiles
  }

  /** Start once for an explicitly selected executor. Stale menus remain usable during refresh. */
  refresh(executor: string, onQuery?: () => void, force = false): Promise<boolean> {
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
      promise: this.refreshIfStale(
        executor,
        () => {
          pending.querying = true
          for (const notify of listeners) notify()
          listeners.clear()
        },
        force
      ).finally(() => this.pending.delete(executor))
    }
    this.pending.set(executor, pending)
    return pending.promise
  }

  private async refreshIfStale(executor: string, onQuery: () => void, force: boolean) {
    await this.hydrate()
    const cached = this.catalogs.get(executor)
    const now = Date.now()
    const fresh = cached?.complete && cached.checkedAt + CATALOG_TTL > now
    const retryAfter = this.retryAfter.get(executor) ?? 0
    if ((!force && fresh) || retryAfter > now) return false
    try {
      onQuery()
      const { write, originalRelays } = await client.fetchRelayList(executor)
      const writes = [...new Set(write)]
      const advertisedWrites = new Set(
        originalRelays.filter((relay) => relay.scope !== 'read').map((relay) => relay.url)
      )
      // The relay list service may supply default relays when write relays are unavailable.
      if (!writes.length || !writes.every((url) => advertisedWrites.has(url))) {
        this.retryAfter.set(executor, Date.now() + RETRY_COOLDOWN)
        return false
      }
      // Never filter by scope before resolving replacements. Read the complete
      // executor catalog, including definitions that moved to another kind.
      const filter = { kinds: [COMMAND_DEFINITION_KIND], authors: [executor] }
      const snapshot = await client.fetchEventSnapshot(writes, filter)
      const events = mergeNipCdCatalogEvents(snapshot.events, executor)
      if (!snapshot.complete) {
        // A partial snapshot cannot establish which cached definitions were removed.
        this.retryAfter.set(executor, Date.now() + RETRY_COOLDOWN)
        if (cached || !events.length) return false
      }
      const record = {
        executor,
        checkedAt: now,
        complete: snapshot.complete,
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
