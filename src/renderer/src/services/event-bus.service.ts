import { TRelayGroup } from '@common/types'

export const EVENT_TYPES = {
  RELAY_GROUPS_CHANGED: 'relay-groups-changed',
  RELOAD_TIMELINE: 'reload-timeline',
  REPLY_COUNT_CHANGED: 'reply-count-changed'
} as const

type TEventMap = {
  [EVENT_TYPES.RELAY_GROUPS_CHANGED]: TRelayGroup[]
  [EVENT_TYPES.RELOAD_TIMELINE]: unknown
  [EVENT_TYPES.REPLY_COUNT_CHANGED]: { eventId: string; replyCount: number }
}

type TCustomEventMap = {
  [K in keyof TEventMap]: CustomEvent<TEventMap[K]>
}

export const createRelayGroupsChangedEvent = (relayGroups: TRelayGroup[]) => {
  return new CustomEvent(EVENT_TYPES.RELAY_GROUPS_CHANGED, { detail: relayGroups })
}
export const createReloadTimelineEvent = () => {
  return new CustomEvent(EVENT_TYPES.RELOAD_TIMELINE)
}
export const createReplyCountChangedEvent = (eventId: string, replyCount: number) => {
  return new CustomEvent(EVENT_TYPES.REPLY_COUNT_CHANGED, { detail: { eventId, replyCount } })
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
