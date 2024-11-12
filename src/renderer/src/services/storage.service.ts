import { TRelayGroup } from '@common/types'
import { createRelayGroupsChangedEvent, eventBus } from './event-bus.service'
import { isElectron } from '@renderer/lib/env'

const DEFAULT_RELAY_GROUPS: TRelayGroup[] = [
  {
    groupName: 'Global',
    relayUrls: [
      'wss://relay.damus.io/',
      'wss://nos.lol/',
      'wss://nostr.mom/',
      'wss://relay.primal.net/'
    ],
    isActive: true
  }
]

class Storage {
  async getRelayGroups() {
    if (isElectron(window)) {
      const relayGroups = await window.api.storage.getRelayGroups()
      return relayGroups ?? DEFAULT_RELAY_GROUPS
    } else {
      const relayGroupsStr = localStorage.getItem('relayGroups')
      return relayGroupsStr ? (JSON.parse(relayGroupsStr) as TRelayGroup[]) : DEFAULT_RELAY_GROUPS
    }
  }

  async setRelayGroups(relayGroups: TRelayGroup[]) {
    if (isElectron(window)) {
      return window.api.storage.setRelayGroups(relayGroups)
    } else {
      localStorage.setItem('relayGroups', JSON.stringify(relayGroups))
    }
  }
}

class StorageService {
  static instance: StorageService

  private initPromise!: Promise<void>
  private relayGroups: TRelayGroup[] = []
  private activeRelayUrls: string[] = []
  private storage: Storage = new Storage()

  constructor() {
    if (!StorageService.instance) {
      this.initPromise = this.init()
      StorageService.instance = this
    }
    return StorageService.instance
  }

  async init() {
    this.relayGroups = await this.storage.getRelayGroups()
    this.activeRelayUrls = this.relayGroups.find((group) => group.isActive)?.relayUrls ?? []
  }

  async getRelayGroups() {
    await this.initPromise
    return this.relayGroups
  }

  async setRelayGroups(relayGroups: TRelayGroup[]) {
    await this.initPromise
    await this.storage.setRelayGroups(relayGroups)
    this.relayGroups = relayGroups
    const newActiveRelayUrls = relayGroups.find((group) => group.isActive)?.relayUrls ?? []
    if (
      this.activeRelayUrls.length !== newActiveRelayUrls.length ||
      this.activeRelayUrls.some((url) => !newActiveRelayUrls.includes(url))
    ) {
      eventBus.emit(createRelayGroupsChangedEvent(relayGroups))
    }
    this.activeRelayUrls = newActiveRelayUrls
  }
}

const instance = new StorageService()

export default instance
