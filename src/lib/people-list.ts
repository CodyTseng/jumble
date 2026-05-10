import { ExtendedKind } from '@/constants'
import { isValidPubkey } from '@/lib/pubkey'
import { TPeopleList } from '@/types'
import { Event, nip19 } from 'nostr-tools'

type TPeopleListEvent = Event & { kind: 30000 }

export function isPeopleListEvent(event?: Event | null): event is TPeopleListEvent {
  return event?.kind === ExtendedKind.PEOPLE_LIST
}

export function getPeopleListTitle(event: Event) {
  return (
    event.tags.find(([name, value]) => ['title', 'name'].includes(name) && !!value)?.[1] ??
    getPeopleListIdentifier(event) ??
    'People list'
  )
}

export function getPeopleListIdentifier(event: Event) {
  return event.tags.find(([name, value]) => name === 'd' && !!value)?.[1]
}

export function getPeopleListPubkeys(event: Event) {
  const pubkeys: string[] = []
  event.tags.forEach(([name, pubkey]) => {
    if (name === 'p' && pubkey && isValidPubkey(pubkey) && !pubkeys.includes(pubkey)) {
      pubkeys.push(pubkey)
    }
  })
  return pubkeys
}

export function getPeopleListNaddr(event: Event, relays: string[] = []) {
  const identifier = getPeopleListIdentifier(event)
  if (!identifier) return null

  return nip19.naddrEncode({
    kind: event.kind,
    pubkey: event.pubkey,
    identifier,
    relays: relays.slice(0, 2)
  })
}

export function getPeopleListInfo(event: Event | null, relays: string[] = []): TPeopleList | null {
  if (!isPeopleListEvent(event)) return null

  const naddr = getPeopleListNaddr(event, relays)
  if (!naddr) return null

  return {
    naddr,
    title: getPeopleListTitle(event),
    author: event.pubkey,
    pubkeys: getPeopleListPubkeys(event),
    event
  }
}
