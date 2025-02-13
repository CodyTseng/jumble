import { useMuteList } from '@/providers/MuteListProvider'
import client from '@/services/client.service'
import { Event, kinds, verifyEvent } from 'nostr-tools'
import { useMemo } from 'react'
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
  const targetEvent = useMemo(() => {
    try {
      const targetEvent = event.content ? (JSON.parse(event.content) as Event) : null
      if (!targetEvent || !verifyEvent(targetEvent) || targetEvent.kind === kinds.Repost) {
        return null
      }
      client.addEventToCache(targetEvent)
      const targetSeenOn = client.getSeenEventRelays(targetEvent.id)
      if (targetSeenOn.length === 0) {
        const seenOn = client.getSeenEventRelays(event.id)
        seenOn.forEach((relay) => {
          client.trackEventSeenOn(targetEvent.id, relay)
        })
      }
      return targetEvent
    } catch {
      return null
    }
  }, [event])
  if (!targetEvent) return null
  if (filterMutedNotes && mutePubkeys.includes(targetEvent.pubkey)) {
    return null
  }

  return <GenericNoteCard className={className} reposter={event.pubkey} event={targetEvent} />
}
