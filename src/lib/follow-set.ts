import { getReplaceableCoordinateFromEvent, getReplaceableEventIdentifier } from '@/lib/event-core'
import { isValidPubkey } from '@/lib/pubkey'
import { getPubkeysFromPTags, tagNameEquals } from '@/lib/tag'
import { TDraftEvent } from '@/types'
import { Event, Filter, kinds } from 'nostr-tools'

export function getFollowSet(event: Event) {
  const identifier = getReplaceableEventIdentifier(event)
  return {
    id: getReplaceableCoordinateFromEvent(event),
    name:
      event.tags.find(tagNameEquals('title'))?.[1]?.trim() ||
      event.tags.find(tagNameEquals('name'))?.[1]?.trim() ||
      identifier,
    pubkeys: getPubkeysFromPTags(event.tags),
    event
  }
}

export type TFollowSet = ReturnType<typeof getFollowSet>

export function getFollowSetDeletionFilters(pubkey: string, events: Event[]): Filter[] {
  if (events.length === 0) return []
  const authors = [pubkey]
  const kindsToFetch = [kinds.EventDeletion]
  return [
    {
      authors,
      kinds: kindsToFetch,
      '#a': [...new Set(events.map(getReplaceableCoordinateFromEvent))]
    },
    { authors, kinds: kindsToFetch, '#e': [...new Set(events.map((event) => event.id))] }
  ]
}

export function mergeFollowSetEvents(pubkey: string, events: Event[]) {
  const sets = new Map<string, Event>()
  const addressDeletions = new Map<string, Event>()
  const eventDeletions = new Map<string, Event>()
  const prefix = `${kinds.Followsets}:${pubkey}:`
  for (const event of events) {
    if (event.pubkey !== pubkey) continue
    if (event.kind === kinds.Followsets) {
      const identifier = getReplaceableEventIdentifier(event)
      if (!identifier || identifier === 'mute') continue
      const old = sets.get(identifier)
      if (
        !old ||
        event.created_at > old.created_at ||
        (event.created_at === old.created_at && event.id < old.id)
      ) {
        sets.set(identifier, event)
      }
    } else if (event.kind === kinds.EventDeletion) {
      for (const [tag, value] of event.tags) {
        if (tag === 'e' && value) {
          eventDeletions.set(value, event)
        } else if (tag === 'a' && value?.startsWith(prefix)) {
          const identifier = value.slice(prefix.length)
          const old = addressDeletions.get(identifier)
          if (!old || event.created_at > old.created_at) addressDeletions.set(identifier, event)
        }
      }
    }
  }

  const heads = Array.from(sets.entries())
    .filter(([id, event]) => (addressDeletions.get(id)?.created_at ?? -1) < event.created_at)
    .map(([, event]) => event)
  return {
    // Keep a deleted head so a relay replaying an older revision cannot make it visible again.
    events: [...heads, ...new Set([...addressDeletions.values(), ...eventDeletions.values()])],
    followSets: heads.filter((event) => !eventDeletions.has(event.id)).map(getFollowSet)
  }
}

export function createFollowSetDraft(
  identifier: string,
  name: string,
  pubkeys: string[],
  previous?: Event
): TDraftEvent {
  const members = new Set(pubkeys.filter(isValidPubkey))
  const tags = (previous?.tags ?? [['d', identifier]]).filter(([name, value]) => {
    return name !== 'title' && (name !== 'p' || members.has(value))
  })
  const retainedMembers = new Set(getPubkeysFromPTags(tags))
  tags.push(['title', name.trim()])
  for (const pubkey of members) {
    if (!retainedMembers.has(pubkey)) tags.push(['p', pubkey])
  }
  return {
    kind: kinds.Followsets,
    created_at: Math.max(Math.floor(Date.now() / 1000), (previous?.created_at ?? -1) + 1),
    content: previous?.content ?? '',
    tags
  }
}
