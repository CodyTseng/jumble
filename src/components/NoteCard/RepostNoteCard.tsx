import { isMentioningMutedUsers } from '@/lib/event'
import { isProfileMutedByNip05Domain } from '@/lib/muted-nip05'
import { generateBech32IdFromATag, generateBech32IdFromETag, tagNameEquals } from '@/lib/tag'
import { useContentPolicy } from '@/providers/ContentPolicyProvider'
import { useFollowList } from '@/providers/FollowListProvider'
import { useMuteList } from '@/providers/MuteListProvider'
import client from '@/services/client.service'
import threadService from '@/services/thread.service'
import { Event, kinds, verifyEvent } from 'nostr-tools'
import { useEffect, useMemo, useState } from 'react'
import MainNoteCard from './MainNoteCard'

export default function RepostNoteCard({
  event,
  className,
  filterMutedNotes = true,
  pinned = false,
  reposters
}: {
  event: Event
  className?: string
  filterMutedNotes?: boolean
  pinned?: boolean
  reposters?: string[]
}) {
  const { mutePubkeySet } = useMuteList()
  const { followingSet } = useFollowList()
  const { hideContentMentioningMutedUsers, mutedNip05Domains } = useContentPolicy()
  const [targetEvent, setTargetEvent] = useState<Event | null>(null)
  const [targetNip05CheckPending, setTargetNip05CheckPending] = useState(false)
  const [targetMutedByNip05Domain, setTargetMutedByNip05Domain] = useState(false)
  const mutedNip05DomainSet = useMemo(
    () => new Set(mutedNip05Domains),
    [mutedNip05Domains]
  )
  const shouldHide = useMemo(() => {
    if (!targetEvent) return true
    if (filterMutedNotes && mutePubkeySet.has(targetEvent.pubkey)) {
      return true
    }
    if (filterMutedNotes && (targetNip05CheckPending || targetMutedByNip05Domain)) {
      return true
    }
    if (hideContentMentioningMutedUsers && isMentioningMutedUsers(targetEvent, mutePubkeySet)) {
      return true
    }
    return false
  }, [
    targetEvent,
    filterMutedNotes,
    mutePubkeySet,
    targetNip05CheckPending,
    targetMutedByNip05Domain,
    hideContentMentioningMutedUsers
  ])
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
        if (
          eventFromContent.kind === kinds.Repost ||
          eventFromContent.kind === kinds.GenericRepost
        ) {
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
        threadService.addRepliesToThread([eventFromContent])
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
        threadService.addRepliesToThread([targetEvent])
      }
    }
    fetch()
  }, [event])

  useEffect(() => {
    let cancelled = false

    setTargetNip05CheckPending(false)
    setTargetMutedByNip05Domain(false)

    if (
      !targetEvent ||
      !filterMutedNotes ||
      mutedNip05DomainSet.size === 0 ||
      followingSet.has(targetEvent.pubkey)
    ) {
      return
    }

    setTargetNip05CheckPending(true)
    client
      .fetchProfile(targetEvent.pubkey)
      .then((profile) => {
        if (cancelled) return
        setTargetMutedByNip05Domain(
          isProfileMutedByNip05Domain(profile, mutedNip05DomainSet, followingSet)
        )
      })
      .finally(() => {
        if (!cancelled) {
          setTargetNip05CheckPending(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [targetEvent, filterMutedNotes, mutedNip05DomainSet, followingSet])

  if (!targetEvent || shouldHide) return null

  return (
    <MainNoteCard
      className={className}
      reposters={reposters?.includes(event.pubkey) ? reposters : [event.pubkey]}
      event={targetEvent}
      pinned={pinned}
    />
  )
}
