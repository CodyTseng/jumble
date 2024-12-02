import client from '@renderer/services/client.service'
import { Event, kinds, verifyEvent } from 'nostr-tools'
import { useMemo } from 'react'
import ShortTextNoteCard from './ShortTextNoteCard'

export default function RepostNoteCard({ event, className }: { event: Event; className?: string }) {
  const targetEvent = useMemo(() => {
    const targetEvent = event.content ? (JSON.parse(event.content) as Event) : null
    try {
      if (!targetEvent || !verifyEvent(targetEvent) || targetEvent.kind !== kinds.ShortTextNote) {
        return null
      }
      client.addEventToCache(targetEvent)
    } catch {
      return null
    }

    return targetEvent
  }, [event])
  if (!targetEvent) return null

  return <ShortTextNoteCard className={className} reposter={event.pubkey} event={targetEvent} />
}
