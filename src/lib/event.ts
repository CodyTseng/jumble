import client from '@/services/client.service'
import { Event, nip19 } from 'nostr-tools'
import { isReplaceableEvent } from './event-core'
import { tagNameEquals } from './tag'

export * from './event-core'

export function getNoteBech32Id(event: Event) {
  const hints = client.getEventHints(event.id).slice(0, 2)
  if (isReplaceableEvent(event.kind)) {
    const identifier = event.tags.find(tagNameEquals('d'))?.[1] ?? ''
    return nip19.naddrEncode({ pubkey: event.pubkey, kind: event.kind, identifier, relays: hints })
  }
  return nip19.neventEncode({ id: event.id, author: event.pubkey, kind: event.kind, relays: hints })
}
