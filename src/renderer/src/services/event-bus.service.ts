import { TRelayGroup } from '@common/types'

export const EVENT_TYPES = {
  RELAY_GROUPS_CHANGED: 'relay-groups-changed',
  RELOAD_TIMELINE: 'reload-timeline'
} as const

interface EventMap {
  [EVENT_TYPES.RELAY_GROUPS_CHANGED]: TRelayGroup[]
  [EVENT_TYPES.RELOAD_TIMELINE]: unknown
}

type CustomEventMap = {
  [K in keyof EventMap]: CustomEvent<EventMap[K]>
}

export const createRelayGroupsChangedEvent = (relayGroups: TRelayGroup[]) => {
  return new CustomEvent(EVENT_TYPES.RELAY_GROUPS_CHANGED, { detail: relayGroups })
}
export const createReloadTimelineEvent = () => {
  return new CustomEvent(EVENT_TYPES.RELOAD_TIMELINE)
}

class EventBus extends EventTarget {
  emit<K extends keyof EventMap>(event: CustomEventMap[K]): boolean {
    return super.dispatchEvent(event)
  }

  on<K extends keyof EventMap>(type: K, listener: (event: CustomEventMap[K]) => void): void {
    super.addEventListener(type, listener as EventListener)
  }

  remove<K extends keyof EventMap>(type: K, listener: (event: CustomEventMap[K]) => void): void {
    super.removeEventListener(type, listener as EventListener)
  }
}

export const eventBus = new EventBus()
