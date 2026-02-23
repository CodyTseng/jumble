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
  DM_CONVERSATIONS: 'dmConversations',
  DM_MESSAGES: 'dmMessages',
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
        const request = window.indexedDB.open('jumble', 13)

        request.onerror = (event) => {
          reject(event)
        }

        request.onsuccess = () => {
          this.db = request.result
          resolve()
        }

        request.onupgradeneeded = () => {
          const db = request.result
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
            dmMessagesStore.createIndex('conversationCreatedAtIndex', [
              'conversationKey',
              'createdAt'
            ])
          } else {
            const transaction = (request.transaction as IDBTransaction)!
            const dmMessagesStore = transaction.objectStore(StoreNames.DM_MESSAGES)
            if (!dmMessagesStore.indexNames.contains('conversationCreatedAtIndex')) {
              dmMessagesStore.createIndex('conversationCreatedAtIndex', [
                'conversationKey',
                'createdAt'
              ])
            }
            if (dmMessagesStore.indexNames.contains('conversationKeyIndex')) {
              dmMessagesStore.deleteIndex('conversationKeyIndex')
            }
            if (dmMessagesStore.indexNames.contains('createdAtIndex')) {
              dmMessagesStore.deleteIndex('createdAtIndex')
            }
          }

          if (db.objectStoreNames.contains(StoreNames.RELAY_INFO_EVENTS)) {
            db.deleteObjectStore(StoreNames.RELAY_INFO_EVENTS)
          }
          if (db.objectStoreNames.contains(StoreNames.MUTE_DECRYPTED_TAGS)) {
            db.deleteObjectStore(StoreNames.MUTE_DECRYPTED_TAGS)
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
          if (conversation.key.includes(accountPubkey)) {
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
    conversationKey: string,
    options?: { limit?: number; before?: number }
  ): Promise<TDmMessage[]> {
    await this.initPromise
    return new Promise((resolve, reject) => {
      if (!this.db) {
        return reject('database not initialized')
      }
      const transaction = this.db.transaction(StoreNames.DM_MESSAGES, 'readonly')
      const store = transaction.objectStore(StoreNames.DM_MESSAGES)
      const index = store.index('conversationCreatedAtIndex')

      const limit = options?.limit ?? 50
      const before = options?.before
      const range =
        before !== undefined
          ? IDBKeyRange.bound([conversationKey, -Infinity], [conversationKey, before], false, true)
          : IDBKeyRange.bound([conversationKey, -Infinity], [conversationKey, Infinity])
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

  async getLatestDmMessage(conversationKey: string): Promise<TDmMessage | null> {
    await this.initPromise
    return new Promise((resolve, reject) => {
      if (!this.db) {
        return reject('database not initialized')
      }
      const transaction = this.db.transaction(StoreNames.DM_MESSAGES, 'readonly')
      const store = transaction.objectStore(StoreNames.DM_MESSAGES)
      const index = store.index('conversationCreatedAtIndex')
      const range = IDBKeyRange.bound([conversationKey, -Infinity], [conversationKey, Infinity])
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
          if (message.conversationKey.includes(accountPubkey)) {
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
