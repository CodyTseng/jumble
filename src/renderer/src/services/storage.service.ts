import { TRelayGroup } from '@common/types'

class StorageService extends EventTarget {
  static instance: StorageService

  constructor() {
    super()
    if (!StorageService.instance) {
      StorageService.instance = this
    }
    return StorageService.instance
  }

  on(event: string, listener: any) {
    this.addEventListener(event, listener)
  }

  off(event: string, listener: any) {
    this.removeEventListener(event, listener)
  }

  emit(event: string, detail?: any) {
    this.dispatchEvent(new CustomEvent(event, { detail }))
  }

  async getRelayGroups() {
    return await window.api.storage.getRelayGroups()
  }

  async setRelayGroups(relayGroups: TRelayGroup[]) {
    await window.api.storage.setRelayGroups(relayGroups)
    this.emit('relayGroupsChanged', relayGroups)
  }
}

const instance = new StorageService()

export default instance
