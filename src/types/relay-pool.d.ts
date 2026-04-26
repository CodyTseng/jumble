import type { Event, EventTemplate, Filter, VerifiedEvent } from 'nostr-tools'

export type TSignAuthEvent = (authEvt: EventTemplate) => Promise<VerifiedEvent>

export type TSubCloser = { close: (reason?: string) => void }

export type TSubHandlers = {
  receivedEvent?: (relay: IRelay, id: string) => void
  alreadyHaveEvent?: (id: string) => boolean
  onevent?: (evt: Event) => void
  oneose?: () => void
  onclose?: (reason: string) => void
  eoseTimeout?: number
}

export interface IRelay {
  readonly url: string
  publishTimeout: number
  publish(event: Event): Promise<unknown>
  auth(signAuthEvent: TSignAuthEvent): Promise<unknown>
  subscribe(filters: Filter[], handlers: TSubHandlers): TSubCloser
}

export interface IRelayPool {
  trackRelays: boolean
  ensureRelay(url: string): Promise<IRelay>
  close(urls: string[]): void
  setAllowInsecure(allow: boolean): void
  getSeenRelays(eventId: string): IRelay[]
  trackEventSeen(eventId: string, relay: IRelay): void
}
