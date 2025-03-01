import { tagNameEquals } from '@/lib/tag'
import { Event, kinds } from 'nostr-tools'

type TValue<T = any> = {
  key: string
  value: T
  addedAt: number
}

const StoreNames = {
  PROFILE_EVENTS: 'profileEvents',
  RELAY_LIST_EVENTS: 'relayListEvents',
  FOLLOW_LIST_EVENTS: 'followListEvents',
  MUTE_LIST_EVENTS: 'muteListEvents',
  MUTE_DECRYPTED_TAGS: 'muteDecryptedTags',
  RELAY_INFO_EVENTS: 'relayInfoEvents'
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
        const request = window.indexedDB.open('jumble', 2)

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
          if (!db.objectStoreNames.contains(StoreNames.MUTE_DECRYPTED_TAGS)) {
            db.createObjectStore(StoreNames.MUTE_DECRYPTED_TAGS, { keyPath: 'key' })
          }
          if (!db.objectStoreNames.contains(StoreNames.RELAY_INFO_EVENTS)) {
            db.createObjectStore(StoreNames.RELAY_INFO_EVENTS, { keyPath: 'key' })
          }
          this.db = db
        }
      })
      setTimeout(() => this.cleanUp(), 1000 * 60) // 1 minute
    }
    return this.initPromise
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

      const getRequest = store.get(event.pubkey)
      getRequest.onsuccess = () => {
        const oldValue = getRequest.result as TValue<Event> | undefined
        if (oldValue && oldValue.value.created_at >= event.created_at) {
          return resolve(oldValue.value)
        }
        const putRequest = store.put(this.formatValue(event.pubkey, event))
        putRequest.onsuccess = () => {
          resolve(event)
        }

        putRequest.onerror = (event) => {
          reject(event)
        }
      }

      getRequest.onerror = (event) => {
        reject(event)
      }
    })
  }

  async getReplaceableEvent(pubkey: string, kind: number): Promise<Event | undefined> {
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
      const request = store.get(pubkey)

      request.onsuccess = () => {
        resolve((request.result as TValue<Event>)?.value)
      }

      request.onerror = (event) => {
        reject(event)
      }
    })
  }

  async getMuteDecryptedTags(id: string): Promise<string[][]> {
    await this.initPromise
    return new Promise((resolve, reject) => {
      if (!this.db) {
        return reject('database not initialized')
      }
      const transaction = this.db.transaction(StoreNames.MUTE_DECRYPTED_TAGS, 'readonly')
      const store = transaction.objectStore(StoreNames.MUTE_DECRYPTED_TAGS)
      const request = store.get(id)

      request.onsuccess = () => {
        resolve((request.result as TValue<string[][]>)?.value)
      }

      request.onerror = (event) => {
        reject(event)
      }
    })
  }

  async putMuteDecryptedTags(id: string, tags: string[][]): Promise<void> {
    await this.initPromise
    return new Promise((resolve, reject) => {
      if (!this.db) {
        return reject('database not initialized')
      }
      const transaction = this.db.transaction(StoreNames.MUTE_DECRYPTED_TAGS, 'readwrite')
      const store = transaction.objectStore(StoreNames.MUTE_DECRYPTED_TAGS)

      const putRequest = store.put(this.formatValue(id, tags))
      putRequest.onsuccess = () => {
        resolve()
      }

      putRequest.onerror = (event) => {
        reject(event)
      }
    })
  }

  async getAllRelayInfoEvents(): Promise<Event[]> {
    await this.initPromise
    return new Promise((resolve, reject) => {
      if (!this.db) {
        return reject('database not initialized')
      }
      const transaction = this.db.transaction(StoreNames.RELAY_INFO_EVENTS, 'readonly')
      const store = transaction.objectStore(StoreNames.RELAY_INFO_EVENTS)
      const request = store.getAll()

      request.onsuccess = () => {
        resolve((request.result as TValue<Event>[])?.map((item) => item.value))
      }

      request.onerror = (event) => {
        reject(event)
      }
    })
  }

  async putRelayInfoEvent(event: Event): Promise<void> {
    await this.initPromise
    return new Promise((resolve, reject) => {
      if (!this.db) {
        return reject('database not initialized')
      }
      const dValue = event.tags.find(tagNameEquals('d'))?.[1]
      if (!dValue) {
        return resolve()
      }
      const transaction = this.db.transaction(StoreNames.RELAY_INFO_EVENTS, 'readwrite')
      const store = transaction.objectStore(StoreNames.RELAY_INFO_EVENTS)

      const putRequest = store.put(this.formatValue(dValue, event))
      putRequest.onsuccess = () => {
        resolve()
      }

      putRequest.onerror = (event) => {
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
          callback((cursor.value as TValue<Event>).value)
          cursor.continue()
        } else {
          resolve()
        }
      }

      request.onerror = (event) => {
        reject(event)
      }
    })
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
      { name: StoreNames.PROFILE_EVENTS, expirationTimestamp: Date.now() - 1000 * 60 * 60 * 24 }, // 1 day
      { name: StoreNames.RELAY_LIST_EVENTS, expirationTimestamp: Date.now() - 1000 * 60 * 60 * 24 }, // 1 day
      {
        name: StoreNames.FOLLOW_LIST_EVENTS,
        expirationTimestamp: Date.now() - 1000 * 60 * 60 * 24
      }, // 1 day
      { name: StoreNames.RELAY_INFO_EVENTS, expirationTimestamp: -1 },
      { name: StoreNames.MUTE_LIST_EVENTS, expirationTimestamp: -1 },
      { name: StoreNames.MUTE_DECRYPTED_TAGS, expirationTimestamp: -1 }
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
}

const instance = IndexedDbService.getInstance()
export default instance
