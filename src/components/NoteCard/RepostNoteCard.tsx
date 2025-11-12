import { isMentioningMutedUsers } from '@/lib/event'
import { generateBech32IdFromATag, generateBech32IdFromETag, tagNameEquals } from '@/lib/tag'
import { useContentPolicy } from '@/providers/ContentPolicyProvider'
import { useMuteList } from '@/providers/MuteListProvider'
import client from '@/services/client.service'
import { Event, kinds, verifyEvent } from 'nostr-tools'
import { useEffect, useMemo, useState } from 'react'
import MainNoteCard from './MainNoteCard'

export default function RepostNoteCard({
  event,
  className,
  filterMutedNotes = true,
  pinned = false
}: {
  event: Event
  className?: string
  filterMutedNotes?: boolean
  pinned?: boolean
}) {
  const { mutePubkeySet } = useMuteList()
  const { hideContentMentioningMutedUsers } = useContentPolicy()
  const [targetEvent, setTargetEvent] = useState<Event | null>(null)
  const shouldHide = useMemo(() => {
    if (!targetEvent) return true
    if (filterMutedNotes && mutePubkeySet.has(targetEvent.pubkey)) {
      return true
    }
    if (hideContentMentioningMutedUsers && isMentioningMutedUsers(targetEvent, mutePubkeySet)) {
      return true
    }
    return false
  }, [targetEvent, filterMutedNotes, hideContentMentioningMutedUsers, mutePubkeySet])
  useEffect(() => {
    const fetch = async () => {
      let eventFromContent: Event | null = null
      if (event.content) {
        try {
          eventFromContent = JSON.parse(event.content) as Event
        } catch {
          eventFromContent = null
        }
      }
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

      let targetEventId: string | undefined
      const aTag = event.tags.find(tagNameEquals('a'))
      if (aTag) {
        targetEventId = generateBech32IdFromATag(aTag)
      } else {
        const eTag = event.tags.find(tagNameEquals('e'))
        if (eTag) {
          targetEventId = generateBech32IdFromETag(eTag)
        }
      }
      if (!targetEventId) {
        return
      }

      const targetEvent = await client.fetchEvent(targetEventId)
      if (targetEvent) {
        setTargetEvent(targetEvent)
      }
    }
    fetch()
  }, [event])

  if (!targetEvent || shouldHide) return null

  return (
    <MainNoteCard
      className={className}
      reposters={[event.pubkey]}
      event={targetEvent}
      pinned={pinned}
    />
  )
}
