import { TRelayGroup } from '@common/types'

export const EVENT_TYPES = {
  RELAY_GROUPS_CHANGED: 'relay-groups-changed'
} as const

type TEventMap = {
  [EVENT_TYPES.RELAY_GROUPS_CHANGED]: TRelayGroup[]
}

type TCustomEventMap = {
  [K in keyof TEventMap]: CustomEvent<TEventMap[K]>
}

export const createRelayGroupsChangedEvent = (relayGroups: TRelayGroup[]) => {
  return new CustomEvent(EVENT_TYPES.RELAY_GROUPS_CHANGED, { detail: relayGroups })
}

class EventBus extends EventTarget {
  emit<K extends keyof TEventMap>(event: TCustomEventMap[K]): boolean {
    return super.dispatchEvent(event)
  }

  on<K extends keyof TEventMap>(type: K, listener: (event: TCustomEventMap[K]) => void): void {
    super.addEventListener(type, listener as EventListener)
  }

  remove<K extends keyof TEventMap>(type: K, listener: (event: TCustomEventMap[K]) => void): void {
    super.removeEventListener(type, listener as EventListener)
  }
}

export const eventBus = new EventBus()
