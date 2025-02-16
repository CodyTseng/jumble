import { tagNameEquals } from '@/lib/tag'
import { useMuteList } from '@/providers/MuteListProvider'
import client from '@/services/client.service'
import { Event, kinds, nip19, verifyEvent } from 'nostr-tools'
import { useEffect, useState } from 'react'
import GenericNoteCard from './GenericNoteCard'

export default function RepostNoteCard({
  event,
  className,
  filterMutedNotes = true
}: {
  event: Event
  className?: string
  filterMutedNotes?: boolean
}) {
  const { mutePubkeys } = useMuteList()
  const [targetEvent, setTargetEvent] = useState<Event | null>(null)
  useEffect(() => {
    const fetch = async () => {
      try {
        const eventFromContent = event.content ? (JSON.parse(event.content) as Event) : null
        if (eventFromContent && verifyEvent(eventFromContent)) {
          if (eventFromContent.kind === kinds.Repost) {
            return
          }
          client.addEventToCache(eventFromContent)
          const targetSeenOn = client.getSeenEventRelays(eventFromContent.id)
          if (targetSeenOn.length === 0) {
            const seenOn = client.getSeenEventRelays(event.id)
            seenOn.forEach((relay) => {
              client.trackEventSeenOn(eventFromContent.id, relay)
            })
          }
          setTargetEvent(eventFromContent)
          return
        }

        const [, id, relay, , pubkey] = event.tags.find(tagNameEquals('e')) ?? []
        if (!id) {
          return
        }
        const targetEventId = nip19.neventEncode({
          id,
          relays: relay ? [relay] : [],
          author: pubkey
        })
        const targetEvent = await client.fetchEvent(targetEventId)
        if (targetEvent) {
          setTargetEvent(targetEvent)
        }
      } catch {
        // ignore
      }
    }
    fetch()
  }, [event])

  if (!targetEvent) return null
  if (filterMutedNotes && mutePubkeys.includes(targetEvent.pubkey)) {
    return null
  }

  return <GenericNoteCard className={className} reposter={event.pubkey} event={targetEvent} />
}
