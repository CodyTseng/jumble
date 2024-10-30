import { TRelayGroup } from '@common/types'
import { createRelayGroupsChangedEvent, eventBus } from './event-bus.service'

class StorageService {
  static instance: StorageService

  constructor() {
    if (!StorageService.instance) {
      StorageService.instance = this
    }
    return StorageService.instance
  }

  async getRelayGroups() {
    return await window.api.storage.getRelayGroups()
  }

  async setRelayGroups(relayGroups: TRelayGroup[]) {
    await window.api.storage.setRelayGroups(relayGroups)
    eventBus.emit(createRelayGroupsChangedEvent(relayGroups))
  }
}

const instance = new StorageService()

export default instance
