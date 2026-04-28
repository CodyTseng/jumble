import { ExtendedKind } from '@/constants'
import { tagNameEquals } from '@/lib/tag'
import { TDmConversation, TDmMessage, TRelayInfo } from '@/types'
import dayjs from 'dayjs'
import { Event, Filter, kinds, matchFilter } from 'nostr-tools'

type TValue<T = any> = {
  key: string
  value: T | null
  addedAt: number
}

const StoreNames = {
  PROFILE_EVENTS: 'profileEvents',
  RELAY_LIST_EVENTS: 'relayListEvents',
  FOLLOW_LIST_EVENTS: 'followListEvents',
  MUTE_LIST_EVENTS: 'muteListEvents',
  BOOKMARK_LIST_EVENTS: 'bookmarkListEvents',
  BLOSSOM_SERVER_LIST_EVENTS: 'blossomServerListEvents',
  USER_EMOJI_LIST_EVENTS: 'userEmojiListEvents',
  EMOJI_SET_EVENTS: 'emojiSetEvents',
  PIN_LIST_EVENTS: 'pinListEvents',
  FAVORITE_RELAYS: 'favoriteRelays',
  RELAY_SETS: 'relaySets',
  FOLLOWING_FAVORITE_RELAYS: 'followingFavoriteRelays',
  RELAY_INFOS: 'relayInfos',
  DECRYPTED_CONTENTS: 'decryptedContents',
  PINNED_USERS_EVENTS: 'pinnedUsersEvents',
  EVENTS: 'events',
  // Per-author cache used by the Pulse view. Unlike EVENTS (which is
  // time-pruned every 5 days), PULSE_EVENTS is capped per author so inactive
  // follows' old posts stay cached indefinitely. Keyed by event id, indexed
  // by pubkey and by created_at.
  PULSE_EVENTS: 'pulseEvents',
  // Per-author metadata for the Pulse view: when we last successfully
  // checked for new posts, and whether that check succeeded. Lets the next
  // check send `since: lastCheckedAt` instead of an unbounded query, so we
  // only fill the gap rather than re-fetching the whole timeline. Keyed by
  // pubkey.
  PULSE_AUTHOR_META: 'pulseAuthorMeta',
  DM_CONVERSATIONS: 'dmConversations',
  DM_MESSAGES: 'dmMessages',
  DM_RELAYS_EVENTS: 'dmRelaysEvents',
  ENCRYPTION_KEY_ANNOUNCEMENT_EVENTS: 'encryptionKeyAnnouncementEvents',
  MUTE_DECRYPTED_TAGS: 'muteDecryptedTags', // deprecated
  RELAY_INFO_EVENTS: 'relayInfoEvents' // deprecated
}

class IndexedDbService {
  static instance: IndexedDbService
  static getInstance(): IndexedDbService {
    if (!IndexedDbService.instance) {
      IndexedDbService.instance = new IndexedDbService()
      IndexedDbService.instance.init()
    }
    return IndexedDbService.instance
  }

  private db: IDBDatabase | null = null
  private initPromise: Promise<void> | null = null

  init(): Promise<void> {
    if (!this.initPromise) {
      this.initPromise = new Promise((resolve, reject) => {
        const request = window.indexedDB.open('jumble', 22)

        request.onerror = (event) => {
          reject(event)
        }

        request.onsuccess = () => {
          this.db = request.result
          resolve()
        }

        request.onupgradeneeded = (event) => {
          const db = request.result
          const oldVersion = (event as IDBVersionChangeEvent).oldVersion
          if (!db.objectStoreNames.contains(StoreNames.PROFILE_EVENTS)) {
            db.createObjectStore(StoreNames.PROFILE_EVENTS, { keyPath: 'key' })
          }
          if (!db.objectStoreNames.contains(StoreNames.RELAY_LIST_EVENTS)) {
            db.createObjectStore(StoreNames.RELAY_LIST_EVENTS, { keyPath: 'key' })
          }
          if (!db.objectStoreNames.contains(StoreNames.FOLLOW_LIST_EVENTS)) {
            db.createObjectStore(StoreNames.FOLLOW_LIST_EVENTS, { keyPath: 'key' })
          }
          if (!db.objectStoreNames.contains(StoreNames.MUTE_LIST_EVENTS)) {
            db.createObjectStore(StoreNames.MUTE_LIST_EVENTS, { keyPath: 'key' })
          }
          if (!db.objectStoreNames.contains(StoreNames.BOOKMARK_LIST_EVENTS)) {
            db.createObjectStore(StoreNames.BOOKMARK_LIST_EVENTS, { keyPath: 'key' })
          }
          if (!db.objectStoreNames.contains(StoreNames.DECRYPTED_CONTENTS)) {
            db.createObjectStore(StoreNames.DECRYPTED_CONTENTS, { keyPath: 'key' })
          }
          if (!db.objectStoreNames.contains(StoreNames.FAVORITE_RELAYS)) {
            db.createObjectStore(StoreNames.FAVORITE_RELAYS, { keyPath: 'key' })
          }
          if (!db.objectStoreNames.contains(StoreNames.RELAY_SETS)) {
            db.createObjectStore(StoreNames.RELAY_SETS, { keyPath: 'key' })
          }
          if (!db.objectStoreNames.contains(StoreNames.FOLLOWING_FAVORITE_RELAYS)) {
            db.createObjectStore(StoreNames.FOLLOWING_FAVORITE_RELAYS, { keyPath: 'key' })
          }
          if (!db.objectStoreNames.contains(StoreNames.BLOSSOM_SERVER_LIST_EVENTS)) {
            db.createObjectStore(StoreNames.BLOSSOM_SERVER_LIST_EVENTS, { keyPath: 'key' })
          }
          if (!db.objectStoreNames.contains(StoreNames.USER_EMOJI_LIST_EVENTS)) {
            db.createObjectStore(StoreNames.USER_EMOJI_LIST_EVENTS, { keyPath: 'key' })
          }
          if (!db.objectStoreNames.contains(StoreNames.EMOJI_SET_EVENTS)) {
            db.createObjectStore(StoreNames.EMOJI_SET_EVENTS, { keyPath: 'key' })
          }
          if (!db.objectStoreNames.contains(StoreNames.RELAY_INFOS)) {
            db.createObjectStore(StoreNames.RELAY_INFOS, { keyPath: 'key' })
          }
          if (!db.objectStoreNames.contains(StoreNames.PIN_LIST_EVENTS)) {
            db.createObjectStore(StoreNames.PIN_LIST_EVENTS, { keyPath: 'key' })
          }
          if (!db.objectStoreNames.contains(StoreNames.PINNED_USERS_EVENTS)) {
            db.createObjectStore(StoreNames.PINNED_USERS_EVENTS, { keyPath: 'key' })
          }
          if (!db.objectStoreNames.contains(StoreNames.EVENTS)) {
            const feedEventsStore = db.createObjectStore(StoreNames.EVENTS, {
              keyPath: 'event.id'
            })
            feedEventsStore.createIndex('createdAtIndex', 'event.created_at')
          }
          if (!db.objectStoreNames.contains(StoreNames.PULSE_EVENTS)) {
            const pulseStore = db.createObjectStore(StoreNames.PULSE_EVENTS, {
              keyPath: 'event.id'
            })
            pulseStore.createIndex('pubkeyIndex', 'event.pubkey')
            pulseStore.createIndex(
              'pubkeyCreatedAtIndex',
              ['event.pubkey', 'event.created_at']
            )
          }
          if (!db.objectStoreNames.contains(StoreNames.PULSE_AUTHOR_META)) {
            db.createObjectStore(StoreNames.PULSE_AUTHOR_META, {
              keyPath: 'pubkey'
            })
          }
          if (!db.objectStoreNames.contains(StoreNames.DM_CONVERSATIONS)) {
            const dmConversationsStore = db.createObjectStore(StoreNames.DM_CONVERSATIONS, {
              keyPath: 'key'
            })
            dmConversationsStore.createIndex('lastMessageAtIndex', 'lastMessageAt')
          }
          if (!db.objectStoreNames.contains(StoreNames.DM_MESSAGES)) {
            const dmMessagesStore = db.createObjectStore(StoreNames.DM_MESSAGES, {
              keyPath: 'id'
            })
            dmMessagesStore.createIndex('participantsCreatedAtIndex', [
              'participantsKey',
              'createdAt'
            ])
          } else {
            const transaction = (request.transaction as IDBTransaction)!
            const dmMessagesStore = transaction.objectStore(StoreNames.DM_MESSAGES)
            if (dmMessagesStore.indexNames.contains('conversationCreatedAtIndex')) {
              dmMessagesStore.deleteIndex('conversationCreatedAtIndex')
            }
            if (dmMessagesStore.indexNames.contains('conversationKeyIndex')) {
              dmMessagesStore.deleteIndex('conversationKeyIndex')
            }
            if (dmMessagesStore.indexNames.contains('createdAtIndex')) {
              dmMessagesStore.deleteIndex('createdAtIndex')
            }
            if (!dmMessagesStore.indexNames.contains('participantsCreatedAtIndex')) {
              dmMessagesStore.createIndex('participantsCreatedAtIndex', [
                'participantsKey',
                'createdAt'
              ])
            }
          }
          if (!db.objectStoreNames.contains(StoreNames.DM_RELAYS_EVENTS)) {
            db.createObjectStore(StoreNames.DM_RELAYS_EVENTS, { keyPath: 'key' })
          }
          if (!db.objectStoreNames.contains(StoreNames.ENCRYPTION_KEY_ANNOUNCEMENT_EVENTS)) {
            db.createObjectStore(StoreNames.ENCRYPTION_KEY_ANNOUNCEMENT_EVENTS, { keyPath: 'key' })
          }

          if (db.objectStoreNames.contains(StoreNames.RELAY_INFO_EVENTS)) {
            db.deleteObjectStore(StoreNames.RELAY_INFO_EVENTS)
          }
          if (db.objectStoreNames.contains(StoreNames.MUTE_DECRYPTED_TAGS)) {
            db.deleteObjectStore(StoreNames.MUTE_DECRYPTED_TAGS)
          }

          // v19: Clear DM data to re-sync with account-scoped conversation keys
          if (oldVersion > 0 && oldVersion < 19) {
            if (db.objectStoreNames.contains(StoreNames.DM_CONVERSATIONS)) {
              const tx = (request.transaction as IDBTransaction)!
              tx.objectStore(StoreNames.DM_CONVERSATIONS).clear()
            }
            if (db.objectStoreNames.contains(StoreNames.DM_MESSAGES)) {
              const tx = (request.transaction as IDBTransaction)!
              tx.objectStore(StoreNames.DM_MESSAGES).clear()
            }
            window.localStorage.removeItem('dmDeletedConversationsMap')
          }

          // v20: Re-key dmMessages from per-account conversationKey to order-independent
          // participantsKey (sorted pubkeys), and migrate the soft-delete state from
          // localStorage.dmDeletedConversationsMap onto the dmConversations records.
          if (oldVersion > 0 && oldVersion >= 19 && oldVersion < 20) {
            const tx = (request.transaction as IDBTransaction)!

            if (db.objectStoreNames.contains(StoreNames.DM_MESSAGES)) {
              const store = tx.objectStore(StoreNames.DM_MESSAGES)
              store.openCursor().onsuccess = (ev) => {
                const cursor = (ev.target as IDBRequest).result as IDBCursorWithValue | null
                if (!cursor) return
                const record = cursor.value as TDmMessage & { conversationKey?: string }
                if (!record.participantsKey && record.conversationKey) {
                  const parts = record.conversationKey.split(':')
                  if (parts.length === 2 && parts[0] && parts[1]) {
                    record.participantsKey = [parts[0], parts[1]].sort().join(':')
                    delete record.conversationKey
                    cursor.update(record)
                  }
                }
                cursor.continue()
              }
            }

            let deletedMap: Record<string, number> = {}
            try {
              const raw = window.localStorage.getItem('dmDeletedConversationsMap')
              if (raw) {
                const parsed = JSON.parse(raw)
                if (parsed && typeof parsed === 'object') deletedMap = parsed
              }
            } catch {
              // ignore
            }

            if (db.objectStoreNames.contains(StoreNames.DM_CONVERSATIONS)) {
              const store = tx.objectStore(StoreNames.DM_CONVERSATIONS)
              store.openCursor().onsuccess = (ev) => {
                const cursor = (ev.target as IDBRequest).result as IDBCursorWithValue | null
                if (!cursor) return
                const conv = cursor.value as TDmConversation
                const delAt = deletedMap[conv.key]
                if (typeof delAt === 'number') {
                  conv.deletedAt = delAt
                  conv.deleted = (conv.lastMessageAt ?? 0) <= delAt
                  cursor.update(conv)
                }
                cursor.continue()
              }
            }

            window.localStorage.removeItem('dmDeletedConversationsMap')
          }

          this.db = db
        }
      })
      setTimeout(() => {
        this.cleanUpOldEvents()
        this.cleanUp()
      }, 1000 * 30) // 30 seconds after initialization
    }
    return this.initPromise
  }

  async putNullReplaceableEvent(pubkey: string, kind: number, d?: string) {
    const storeName = this.getStoreNameByKind(kind)
    if (!storeName) {
      return Promise.reject('store name not found')
    }
    await this.initPromise
    return new Promise((resolve, reject) => {
      if (!this.db) {
        return reject('database not initialized')
      }
      const transaction = this.db.transaction(storeName, 'readwrite')
      const store = transaction.objectStore(storeName)

      const key = this.getReplaceableEventKey(pubkey, d)
      const getRequest = store.get(key)
      getRequest.onsuccess = () => {
        const oldValue = getRequest.result as TValue<Event> | undefined
        if (oldValue) {
          transaction.commit()
          return resolve(oldValue.value)
        }
        const putRequest = store.put(this.formatValue(key, null))
        putRequest.onsuccess = () => {
          transaction.commit()
          resolve(null)
        }

        putRequest.onerror = (event) => {
          transaction.commit()
          reject(event)
        }
      }

      getRequest.onerror = (event) => {
        transaction.commit()
        reject(event)
      }
    })
  }

  async putReplaceableEvent(event: Event): Promise<Event> {
    const storeName = this.getStoreNameByKind(event.kind)
    if (!storeName) {
      return Promise.reject('store name not found')
    }
    await this.initPromise
    return new Promise((resolve, reject) => {
      if (!this.db) {
        return reject('database not initialized')
      }
      const transaction = this.db.transaction(storeName, 'readwrite')
      const store = transaction.objectStore(storeName)

      const key = this.getReplaceableEventKeyFromEvent(event)
      const getRequest = store.get(key)
      getRequest.onsuccess = () => {
        const oldValue = getRequest.result as TValue<Event> | undefined
        if (oldValue?.value && oldValue.value.created_at >= event.created_at) {
          transaction.commit()
          return resolve(oldValue.value)
        }
        const putRequest = store.put(this.formatValue(key, event))
        putRequest.onsuccess = () => {
          transaction.commit()
          resolve(event)
        }

        putRequest.onerror = (event) => {
          transaction.commit()
          reject(event)
        }
      }

      getRequest.onerror = (event) => {
        transaction.commit()
        reject(event)
      }
    })
  }

  async getReplaceableEventByCoordinate(coordinate: string): Promise<Event | undefined | null> {
    const [kind, pubkey, ...rest] = coordinate.split(':')
    const d = rest.length > 0 ? rest.join(':') : undefined
    return this.getReplaceableEvent(pubkey, parseInt(kind), d)
  }

  async getReplaceableEvent(
    pubkey: string,
    kind: number,
    d?: string
  ): Promise<Event | undefined | null> {
    const storeName = this.getStoreNameByKind(kind)
    if (!storeName) {
      return undefined
    }
    await this.initPromise
    return new Promise((resolve, reject) => {
      if (!this.db) {
        return reject('database not initialized')
      }
      const transaction = this.db.transaction(storeName, 'readonly')
      const store = transaction.objectStore(storeName)
      const key = this.getReplaceableEventKey(pubkey, d)
      const request = store.get(key)

      request.onsuccess = () => {
        transaction.commit()
        resolve((request.result as TValue<Event>)?.value)
      }

      request.onerror = (event) => {
        transaction.commit()
        reject(event)
      }
    })
  }

  async getManyReplaceableEvents(
    pubkeys: readonly string[],
    kind: number
  ): Promise<(Event | undefined | null)[]> {
    const storeName = this.getStoreNameByKind(kind)
    if (!storeName) {
      return Promise.reject('store name not found')
    }
    await this.initPromise
    return new Promise((resolve, reject) => {
      if (!this.db) {
        return reject('database not initialized')
      }
      const transaction = this.db.transaction(storeName, 'readonly')
      const store = transaction.objectStore(storeName)
      const events: (Event | null)[] = new Array(pubkeys.length).fill(undefined)
      let count = 0
      pubkeys.forEach((pubkey, i) => {
        const request = store.get(this.getReplaceableEventKey(pubkey))

        request.onsuccess = () => {
          const event = (request.result as TValue<Event | null>)?.value
          if (event || event === null) {
            events[i] = event
          }

          if (++count === pubkeys.length) {
            transaction.commit()
            resolve(events)
          }
        }

        request.onerror = () => {
          if (++count === pubkeys.length) {
            transaction.commit()
            resolve(events)
          }
        }
      })
    })
  }

  async getDecryptedContent(key: string): Promise<string | null> {
    await this.initPromise
    return new Promise((resolve, reject) => {
      if (!this.db) {
        return reject('database not initialized')
      }
      const transaction = this.db.transaction(StoreNames.DECRYPTED_CONTENTS, 'readonly')
      const store = transaction.objectStore(StoreNames.DECRYPTED_CONTENTS)
      const request = store.get(key)

      request.onsuccess = () => {
        transaction.commit()
        resolve((request.result as TValue<string>)?.value)
      }

      request.onerror = (event) => {
        transaction.commit()
        reject(event)
      }
    })
  }

  async putDecryptedContent(key: string, content: string): Promise<void> {
    await this.initPromise
    return new Promise((resolve, reject) => {
      if (!this.db) {
        return reject('database not initialized')
      }
      const transaction = this.db.transaction(StoreNames.DECRYPTED_CONTENTS, 'readwrite')
      const store = transaction.objectStore(StoreNames.DECRYPTED_CONTENTS)

      const putRequest = store.put(this.formatValue(key, content))
      putRequest.onsuccess = () => {
        transaction.commit()
        resolve()
      }

      putRequest.onerror = (event) => {
        transaction.commit()
        reject(event)
      }
    })
  }

  async iterateProfileEvents(callback: (event: Event) => Promise<void>): Promise<void> {
    await this.initPromise
    if (!this.db) {
      return
    }

    return new Promise<void>((resolve, reject) => {
      const transaction = this.db!.transaction(StoreNames.PROFILE_EVENTS, 'readwrite')
      const store = transaction.objectStore(StoreNames.PROFILE_EVENTS)
      const request = store.openCursor()
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result
        if (cursor) {
          const value = (cursor.value as TValue<Event>).value
          if (value) {
            callback(value)
          }
          cursor.continue()
        } else {
          transaction.commit()
          resolve()
        }
      }

      request.onerror = (event) => {
        transaction.commit()
        reject(event)
      }
    })
  }

  async putFollowingFavoriteRelays(pubkey: string, relays: [string, string[]][]): Promise<void> {
    await this.initPromise
    return new Promise((resolve, reject) => {
      if (!this.db) {
        return reject('database not initialized')
      }
      const transaction = this.db.transaction(StoreNames.FOLLOWING_FAVORITE_RELAYS, 'readwrite')
      const store = transaction.objectStore(StoreNames.FOLLOWING_FAVORITE_RELAYS)

      const putRequest = store.put(this.formatValue(pubkey, relays))
      putRequest.onsuccess = () => {
        transaction.commit()
        resolve()
      }

      putRequest.onerror = (event) => {
        transaction.commit()
        reject(event)
      }
    })
  }

  async getFollowingFavoriteRelays(pubkey: string): Promise<[string, string[]][] | null> {
    await this.initPromise
    return new Promise((resolve, reject) => {
      if (!this.db) {
        return reject('database not initialized')
      }
      const transaction = this.db.transaction(StoreNames.FOLLOWING_FAVORITE_RELAYS, 'readonly')
      const store = transaction.objectStore(StoreNames.FOLLOWING_FAVORITE_RELAYS)
      const request = store.get(pubkey)

      request.onsuccess = () => {
        transaction.commit()
        resolve((request.result as TValue<[string, string[]][]>)?.value)
      }

      request.onerror = (event) => {
        transaction.commit()
        reject(event)
      }
    })
  }

  async putRelayInfo(relayInfo: TRelayInfo): Promise<void> {
    await this.initPromise
    return new Promise((resolve, reject) => {
      if (!this.db) {
        return reject('database not initialized')
      }
      const transaction = this.db.transaction(StoreNames.RELAY_INFOS, 'readwrite')
      const store = transaction.objectStore(StoreNames.RELAY_INFOS)

      const putRequest = store.put(this.formatValue(relayInfo.url, relayInfo))
      putRequest.onsuccess = () => {
        transaction.commit()
        resolve()
      }

      putRequest.onerror = (event) => {
        transaction.commit()
        reject(event)
      }
    })
  }

  async getRelayInfo(url: string): Promise<TRelayInfo | null> {
    await this.initPromise
    return new Promise((resolve, reject) => {
      if (!this.db) {
        return reject('database not initialized')
      }
      const transaction = this.db.transaction(StoreNames.RELAY_INFOS, 'readonly')
      const store = transaction.objectStore(StoreNames.RELAY_INFOS)
      const request = store.get(url)

      request.onsuccess = () => {
        transaction.commit()
        resolve((request.result as TValue<TRelayInfo>)?.value)
      }

      request.onerror = (event) => {
        transaction.commit()
        reject(event)
      }
    })
  }

  async putEvents(items: { event: Event; relays: string[] }[]): Promise<void> {
    await this.initPromise
    return new Promise((resolve, reject) => {
      if (!this.db) {
        return reject('database not initialized')
      }
      const transaction = this.db.transaction(StoreNames.EVENTS, 'readwrite')
      const store = transaction.objectStore(StoreNames.EVENTS)

      let completed = 0
      items.forEach((item) => {
        const putRequest = store.put(item)
        putRequest.onsuccess = () => {
          completed++
          if (completed === items.length) {
            transaction.commit()
            resolve()
          }
        }

        putRequest.onerror = (event) => {
          transaction.commit()
          reject(event)
        }
      })
    })
  }

  async getEvents({ limit, ...filter }: Filter): Promise<{ event: Event; relays: string[] }[]> {
    await this.initPromise
    return new Promise((resolve, reject) => {
      if (!this.db) {
        return reject('database not initialized')
      }
      const transaction = this.db.transaction(StoreNames.EVENTS, 'readonly')
      const store = transaction.objectStore(StoreNames.EVENTS)
      const index = store.index('createdAtIndex')
      const request = index.openCursor(null, 'prev')

      const results: { event: Event; relays: string[] }[] = []
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result
        if (cursor && (!limit || results.length < limit)) {
          const item = cursor.value as { event: Event; relays: string[] }
          if (matchFilter(filter, item.event)) {
            results.push(item)
          }
          cursor.continue()
        } else {
          transaction.commit()
          resolve(results)
        }
      }

      request.onerror = (event) => {
        transaction.commit()
        reject(event)
      }
    })
  }

  // ----- Pulse per-author cache ---------------------------------------

  // Store events for the Pulse view. We cap to `perAuthorCap` most-recent
  // events per author so the store stays bounded even after years of use.
  // Each call:
  //   1) writes the new events,
  //   2) for every affected pubkey, drops any record beyond the cap.
  // Cap trimming happens inside the same transaction so the store never
  // holds more than cap*authors records.
  async putPulseEvents(
    items: { event: Event; relays: string[] }[],
    perAuthorCap: number
  ): Promise<void> {
    await this.initPromise
    if (!this.db) return
    if (items.length === 0) return

    const db = this.db
    const affectedPubkeys = new Set(items.map((i) => i.event.pubkey))

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(StoreNames.PULSE_EVENTS, 'readwrite')
      const store = transaction.objectStore(StoreNames.PULSE_EVENTS)
      const index = store.index('pubkeyCreatedAtIndex')

      transaction.oncomplete = () => resolve()
      transaction.onerror = (ev) => reject(ev)
      transaction.onabort = (ev) => reject(ev)

      // 1) Upsert all new items.
      for (const item of items) {
        store.put(item)
      }

      // 2) For each affected pubkey, keep only the top N by created_at.
      //    We walk the index in reverse (newest first) and delete anything
      //    past the cap.
      for (const pubkey of affectedPubkeys) {
        const range = IDBKeyRange.bound(
          [pubkey, -Infinity],
          [pubkey, Infinity]
        )
        const req = index.openCursor(range, 'prev')
        let kept = 0
        req.onsuccess = (ev) => {
          const cursor = (ev.target as IDBRequest).result as
            | IDBCursorWithValue
            | null
          if (!cursor) return
          if (kept < perAuthorCap) {
            kept++
            cursor.continue()
          } else {
            cursor.delete()
            cursor.continue()
          }
        }
      }
    })
  }

  // Return up to `perAuthorCap` most-recent cached events for each of the
  // given pubkeys. Used to hydrate the Pulse view instantly on open.
  async getPulseEventsForAuthors(
    pubkeys: string[],
    perAuthorCap: number
  ): Promise<Event[]> {
    await this.initPromise
    if (!this.db) return []
    if (pubkeys.length === 0) return []

    const db = this.db
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(StoreNames.PULSE_EVENTS, 'readonly')
      const store = transaction.objectStore(StoreNames.PULSE_EVENTS)
      const index = store.index('pubkeyCreatedAtIndex')
      const out: Event[] = []

      let pending = pubkeys.length
      const done = () => {
        pending--
        if (pending === 0) {
          resolve(out)
        }
      }

      for (const pubkey of pubkeys) {
        const range = IDBKeyRange.bound(
          [pubkey, -Infinity],
          [pubkey, Infinity]
        )
        const req = index.openCursor(range, 'prev')
        let collected = 0
        req.onsuccess = (ev) => {
          const cursor = (ev.target as IDBRequest).result as
            | IDBCursorWithValue
            | null
          if (!cursor || collected >= perAuthorCap) {
            done()
            return
          }
          const item = cursor.value as { event: Event; relays: string[] }
          out.push(item.event)
          collected++
          cursor.continue()
        }
        req.onerror = (ev) => reject(ev)
      }
    })
  }

  // Bulk set last-checked timestamps for Pulse authors. Only call this
  // AFTER a successful fetch for that author — timeout / network errors
  // must leave the previous timestamp untouched so the next attempt
  // still fills the whole missed window.
  async putPulseAuthorMeta(
    items: { pubkey: string; lastCheckedAt: number; lastCheckOk: boolean }[]
  ): Promise<void> {
    await this.initPromise
    if (!this.db) return
    if (items.length === 0) return

    const db = this.db
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(StoreNames.PULSE_AUTHOR_META, 'readwrite')
      const store = transaction.objectStore(StoreNames.PULSE_AUTHOR_META)
      transaction.oncomplete = () => resolve()
      transaction.onerror = (ev) => reject(ev)
      transaction.onabort = (ev) => reject(ev)
      for (const item of items) {
        store.put(item)
      }
    })
  }

  async getPulseAuthorMeta(
    pubkeys: string[]
  ): Promise<Map<string, { lastCheckedAt: number; lastCheckOk: boolean }>> {
    await this.initPromise
    const out = new Map<string, { lastCheckedAt: number; lastCheckOk: boolean }>()
    if (!this.db) return out
    if (pubkeys.length === 0) return out

    const db = this.db
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(StoreNames.PULSE_AUTHOR_META, 'readonly')
      const store = transaction.objectStore(StoreNames.PULSE_AUTHOR_META)
      let pending = pubkeys.length
      const done = () => {
        pending--
        if (pending === 0) resolve(out)
      }
      for (const pubkey of pubkeys) {
        const req = store.get(pubkey)
        req.onsuccess = () => {
          const v = req.result as
            | { pubkey: string; lastCheckedAt: number; lastCheckOk: boolean }
            | undefined
          if (v) out.set(pubkey, { lastCheckedAt: v.lastCheckedAt, lastCheckOk: v.lastCheckOk })
          done()
        }
        req.onerror = (ev) => reject(ev)
      }
    })
  }

  async deleteEvents(filter: Filter & { until: number }): Promise<void> {
    await this.initPromise
    return new Promise((resolve, reject) => {
      if (!this.db) {
        return reject('database not initialized')
      }
      const transaction = this.db.transaction(StoreNames.EVENTS, 'readwrite')
      const store = transaction.objectStore(StoreNames.EVENTS)
      const index = store.index('createdAtIndex')
      const request = index.openCursor(IDBKeyRange.upperBound(filter.until, true))

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result
        if (cursor) {
          const item = cursor.value as { event: Event; relays: string[] }
          if (matchFilter(filter, item.event)) {
            cursor.delete()
          }
          cursor.continue()
        } else {
          transaction.commit()
          resolve()
        }
      }

      request.onerror = (event) => {
        transaction.commit()
        reject(event)
      }
    })
  }

  async putDmConversation(conversation: TDmConversation): Promise<void> {
    await this.initPromise
    return new Promise((resolve, reject) => {
      if (!this.db) {
        return reject('database not initialized')
      }
      const transaction = this.db.transaction(StoreNames.DM_CONVERSATIONS, 'readwrite')
      const store = transaction.objectStore(StoreNames.DM_CONVERSATIONS)

      const putRequest = store.put(conversation)
      putRequest.onsuccess = () => {
        transaction.commit()
        resolve()
      }

      putRequest.onerror = (event) => {
        transaction.commit()
        reject(event)
      }
    })
  }

  async getDmConversation(key: string): Promise<TDmConversation | null> {
    await this.initPromise
    return new Promise((resolve, reject) => {
      if (!this.db) {
        return reject('database not initialized')
      }
      const transaction = this.db.transaction(StoreNames.DM_CONVERSATIONS, 'readonly')
      const store = transaction.objectStore(StoreNames.DM_CONVERSATIONS)
      const request = store.get(key)

      request.onsuccess = () => {
        transaction.commit()
        resolve(request.result ?? null)
      }

      request.onerror = (event) => {
        transaction.commit()
        reject(event)
      }
    })
  }

  async getAllDmConversations(accountPubkey: string): Promise<TDmConversation[]> {
    await this.initPromise
    return new Promise((resolve, reject) => {
      if (!this.db) {
        return reject('database not initialized')
      }
      const transaction = this.db.transaction(StoreNames.DM_CONVERSATIONS, 'readonly')
      const store = transaction.objectStore(StoreNames.DM_CONVERSATIONS)
      const index = store.index('lastMessageAtIndex')
      const request = index.openCursor(null, 'prev')

      const results: TDmConversation[] = []
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result
        if (cursor) {
          const conversation = cursor.value as TDmConversation
          if (conversation.key.startsWith(accountPubkey + ':')) {
            results.push(conversation)
          }
          cursor.continue()
        } else {
          transaction.commit()
          resolve(results)
        }
      }

      request.onerror = (event) => {
        transaction.commit()
        reject(event)
      }
    })
  }

  async hasDmMessages(): Promise<boolean> {
    await this.initPromise
    return new Promise((resolve, reject) => {
      if (!this.db) {
        return reject('database not initialized')
      }
      const transaction = this.db.transaction(StoreNames.DM_MESSAGES, 'readonly')
      const store = transaction.objectStore(StoreNames.DM_MESSAGES)
      const request = store.openCursor()

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result
        transaction.commit()
        resolve(!!cursor)
      }

      request.onerror = (event) => {
        transaction.commit()
        reject(event)
      }
    })
  }

  async putDmMessage(message: TDmMessage): Promise<void> {
    await this.initPromise
    return new Promise((resolve, reject) => {
      if (!this.db) {
        return reject('database not initialized')
      }
      const transaction = this.db.transaction(StoreNames.DM_MESSAGES, 'readwrite')
      const store = transaction.objectStore(StoreNames.DM_MESSAGES)

      const putRequest = store.put(message)
      putRequest.onsuccess = () => {
        transaction.commit()
        resolve()
      }

      putRequest.onerror = (event) => {
        transaction.commit()
        reject(event)
      }
    })
  }

  async getDmMessages(
    participantsKey: string,
    options?: { limit?: number; before?: number; after?: number }
  ): Promise<TDmMessage[]> {
    await this.initPromise
    return new Promise((resolve, reject) => {
      if (!this.db) {
        return reject('database not initialized')
      }
      const transaction = this.db.transaction(StoreNames.DM_MESSAGES, 'readonly')
      const store = transaction.objectStore(StoreNames.DM_MESSAGES)
      const index = store.index('participantsCreatedAtIndex')

      const limit = options?.limit ?? 50
      const before = options?.before
      const after = options?.after
      const lowerBound = after !== undefined ? after : -Infinity
      const lowerOpen = after !== undefined
      const upperBound = before !== undefined ? before : Infinity
      const upperOpen = before !== undefined
      const range = IDBKeyRange.bound(
        [participantsKey, lowerBound],
        [participantsKey, upperBound],
        lowerOpen,
        upperOpen
      )
      const request = index.openCursor(range, 'prev')

      const results: TDmMessage[] = []

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result
        if (cursor && results.length < limit) {
          results.push(cursor.value as TDmMessage)
          cursor.continue()
        } else {
          transaction.commit()
          results.reverse()
          resolve(results)
        }
      }

      request.onerror = (event) => {
        transaction.commit()
        reject(event)
      }
    })
  }

  async getLatestDmMessage(participantsKey: string): Promise<TDmMessage | null> {
    await this.initPromise
    return new Promise((resolve, reject) => {
      if (!this.db) {
        return reject('database not initialized')
      }
      const transaction = this.db.transaction(StoreNames.DM_MESSAGES, 'readonly')
      const store = transaction.objectStore(StoreNames.DM_MESSAGES)
      const index = store.index('participantsCreatedAtIndex')
      const range = IDBKeyRange.bound([participantsKey, -Infinity], [participantsKey, Infinity])
      const request = index.openCursor(range, 'prev')

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result
        transaction.commit()
        resolve(cursor ? (cursor.value as TDmMessage) : null)
      }

      request.onerror = (event) => {
        transaction.commit()
        reject(event)
      }
    })
  }

  async getAllDmMessagesForAccount(accountPubkey: string): Promise<TDmMessage[]> {
    await this.initPromise
    return new Promise((resolve, reject) => {
      if (!this.db) {
        return reject('database not initialized')
      }
      const transaction = this.db.transaction(StoreNames.DM_MESSAGES, 'readonly')
      const store = transaction.objectStore(StoreNames.DM_MESSAGES)
      const request = store.openCursor()

      const results: TDmMessage[] = []
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result
        if (cursor) {
          const message = cursor.value as TDmMessage
          if (message.participantsKey?.includes(accountPubkey)) {
            results.push(message)
          }
          cursor.continue()
        } else {
          transaction.commit()
          resolve(results)
        }
      }

      request.onerror = (event) => {
        transaction.commit()
        reject(event)
      }
    })
  }

  async getDmMessageById(id: string): Promise<TDmMessage | null> {
    await this.initPromise
    return new Promise((resolve, reject) => {
      if (!this.db) {
        return reject('database not initialized')
      }
      const transaction = this.db.transaction(StoreNames.DM_MESSAGES, 'readonly')
      const store = transaction.objectStore(StoreNames.DM_MESSAGES)
      const request = store.get(id)

      request.onsuccess = () => {
        transaction.commit()
        resolve(request.result ? (request.result as TDmMessage) : null)
      }

      request.onerror = (event) => {
        transaction.commit()
        reject(event)
      }
    })
  }

  async deleteDmConversation(key: string): Promise<void> {
    await this.initPromise
    return new Promise((resolve, reject) => {
      if (!this.db) {
        return reject('database not initialized')
      }
      const transaction = this.db.transaction(StoreNames.DM_CONVERSATIONS, 'readwrite')
      const store = transaction.objectStore(StoreNames.DM_CONVERSATIONS)

      const deleteRequest = store.delete(key)
      deleteRequest.onsuccess = () => {
        transaction.commit()
        resolve()
      }

      deleteRequest.onerror = (event) => {
        transaction.commit()
        reject(event)
      }
    })
  }

  async deleteDmMessagesByParticipantsKey(participantsKey: string): Promise<void> {
    await this.initPromise
    return new Promise((resolve, reject) => {
      if (!this.db) {
        return reject('database not initialized')
      }
      const transaction = this.db.transaction(StoreNames.DM_MESSAGES, 'readwrite')
      const store = transaction.objectStore(StoreNames.DM_MESSAGES)
      const index = store.index('participantsCreatedAtIndex')
      const range = IDBKeyRange.bound([participantsKey, -Infinity], [participantsKey, Infinity])
      const request = index.openCursor(range)

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result
        if (cursor) {
          cursor.delete()
          cursor.continue()
        } else {
          transaction.commit()
          resolve()
        }
      }

      request.onerror = (event) => {
        transaction.commit()
        reject(event)
      }
    })
  }

  private getReplaceableEventKeyFromEvent(event: Event): string {
    if (
      [kinds.Metadata, kinds.Contacts].includes(event.kind) ||
      (event.kind >= 10000 && event.kind < 20000)
    ) {
      return this.getReplaceableEventKey(event.pubkey)
    }

    const [, d] = event.tags.find(tagNameEquals('d')) ?? []
    return this.getReplaceableEventKey(event.pubkey, d)
  }

  private getReplaceableEventKey(pubkey: string, d?: string): string {
    return d === undefined ? pubkey : `${pubkey}:${d}`
  }

  private getStoreNameByKind(kind: number): string | undefined {
    switch (kind) {
      case kinds.Metadata:
        return StoreNames.PROFILE_EVENTS
      case kinds.RelayList:
        return StoreNames.RELAY_LIST_EVENTS
      case kinds.Contacts:
        return StoreNames.FOLLOW_LIST_EVENTS
      case kinds.Mutelist:
        return StoreNames.MUTE_LIST_EVENTS
      case ExtendedKind.BLOSSOM_SERVER_LIST:
        return StoreNames.BLOSSOM_SERVER_LIST_EVENTS
      case kinds.Relaysets:
        return StoreNames.RELAY_SETS
      case ExtendedKind.FAVORITE_RELAYS:
        return StoreNames.FAVORITE_RELAYS
      case kinds.BookmarkList:
        return StoreNames.BOOKMARK_LIST_EVENTS
      case kinds.UserEmojiList:
        return StoreNames.USER_EMOJI_LIST_EVENTS
      case kinds.Emojisets:
        return StoreNames.EMOJI_SET_EVENTS
      case kinds.Pinlist:
        return StoreNames.PIN_LIST_EVENTS
      case ExtendedKind.PINNED_USERS:
        return StoreNames.PINNED_USERS_EVENTS
      case ExtendedKind.ENCRYPTION_KEY_ANNOUNCEMENT:
        return StoreNames.ENCRYPTION_KEY_ANNOUNCEMENT_EVENTS
      case ExtendedKind.DM_RELAYS:
        return StoreNames.DM_RELAYS_EVENTS
      default:
        return undefined
    }
  }

  private formatValue<T>(key: string, value: T): TValue<T> {
    return {
      key,
      value,
      addedAt: Date.now()
    }
  }

  private async cleanUp() {
    await this.initPromise
    if (!this.db) {
      return
    }

    const stores = [
      {
        name: StoreNames.PROFILE_EVENTS,
        expirationTimestamp: Date.now() - 1000 * 60 * 60 * 24 * 30 // 30 day
      },
      {
        name: StoreNames.RELAY_LIST_EVENTS,
        expirationTimestamp: Date.now() - 1000 * 60 * 60 * 24 * 30 // 30 day
      },
      {
        name: StoreNames.FOLLOW_LIST_EVENTS,
        expirationTimestamp: Date.now() - 1000 * 60 * 60 * 24 * 30 // 30 day
      },
      {
        name: StoreNames.BLOSSOM_SERVER_LIST_EVENTS,
        expirationTimestamp: Date.now() - 1000 * 60 * 60 * 24 * 30 // 30 day
      },
      {
        name: StoreNames.RELAY_INFOS,
        expirationTimestamp: Date.now() - 1000 * 60 * 60 * 24 * 30 // 30 day
      },
      {
        name: StoreNames.PIN_LIST_EVENTS,
        expirationTimestamp: Date.now() - 1000 * 60 * 60 * 24 * 30 // 30 days
      },
      {
        name: StoreNames.USER_EMOJI_LIST_EVENTS,
        expirationTimestamp: Date.now() - 1000 * 60 * 60 * 24 * 7 // 7 days
      },
      {
        name: StoreNames.EMOJI_SET_EVENTS,
        expirationTimestamp: Date.now() - 1000 * 60 * 60 * 24 * 7 // 7 days
      }
    ]
    const transaction = this.db!.transaction(
      stores.map((store) => store.name),
      'readwrite'
    )
    await Promise.allSettled(
      stores.map(({ name, expirationTimestamp }) => {
        if (expirationTimestamp < 0) {
          return Promise.resolve()
        }
        return new Promise<void>((resolve, reject) => {
          const store = transaction.objectStore(name)
          const request = store.openCursor()
          request.onsuccess = (event) => {
            const cursor = (event.target as IDBRequest).result
            if (cursor) {
              const value: TValue = cursor.value
              if (value.addedAt < expirationTimestamp) {
                cursor.delete()
              }
              cursor.continue()
            } else {
              resolve()
            }
          }

          request.onerror = (event) => {
            reject(event)
          }
        })
      })
    )
  }

  private async cleanUpOldEvents() {
    await this.initPromise
    if (!this.db) {
      return
    }

    const transaction = this.db!.transaction(StoreNames.EVENTS, 'readwrite')
    const store = transaction.objectStore(StoreNames.EVENTS)
    const index = store.index('createdAtIndex')
    const request = index.openCursor(IDBKeyRange.upperBound(dayjs().subtract(5, 'days').unix()))

    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest).result
      if (cursor) {
        cursor.delete()
        cursor.continue()
      } else {
        transaction.commit()
      }
    }

    request.onerror = (event) => {
      transaction.commit()
      console.error('Failed to clean up old events:', event)
    }
  }
}

const instance = IndexedDbService.getInstance()
export default instance
