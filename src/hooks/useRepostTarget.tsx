import { generateBech32IdFromATag, generateBech32IdFromETag, tagNameEquals } from '@/lib/tag'
import client from '@/services/client.service'
import lightning from '@/services/lightning.service'
import threadService from '@/services/thread.service'
import { Event, kinds, verifyEvent } from 'nostr-tools'
import { useEffect, useState } from 'react'

export function isRepostEvent(event?: Event | null): boolean {
  if (!event) return false
  return event.kind === kinds.Repost || event.kind === kinds.GenericRepost
}

/**
 * Resolves the target event of a kind 6 / 16 (generic) repost.
 *
 * 1. Tries to parse and verify the inline event in `content` (NIP-18).
 * 2. Falls back to fetching via the first `e` or `a` tag.
 * 3. Refuses to recurse: if the target itself is a repost, returns no target.
 *
 * Callers should guard with `isRepostEvent` before consuming the result.
 */
export function useRepostTarget(event?: Event | null) {
  const [targetEvent, setTargetEvent] = useState<Event | null>(null)
  const [isResolving, setIsResolving] = useState<boolean>(() => isRepostEvent(event))

  useEffect(() => {
    if (!event || !isRepostEvent(event)) {
      setTargetEvent(null)
      setIsResolving(false)
      return
    }

    let cancelled = false
    setIsResolving(true)
    setTargetEvent(null)

    const run = async () => {
      let eventFromContent: Event | null = null
      if (event.content) {
        try {
          eventFromContent = JSON.parse(event.content) as Event
        } catch {
          eventFromContent = null
        }
      }
      if (eventFromContent && verifyEvent(eventFromContent)) {
        if (isRepostEvent(eventFromContent)) {
          return
        }
        if (
          eventFromContent.kind === kinds.Zap &&
          !(await lightning.validateZapReceipt(eventFromContent))
        ) {
          return
        }
        client.addEventToCache(eventFromContent)
        const targetSeenOn = client.getSeenEventRelays(eventFromContent.id)
        if (targetSeenOn.length === 0) {
          const seenOn = client.getSeenEventRelays(event.id)
          seenOn.forEach((relay) => {
            client.trackEventSeenOn(eventFromContent!.id, relay)
          })
        }
        if (cancelled) return
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
      if (!targetEventId) return

      const fetched = await client.fetchEvent(targetEventId)
      if (cancelled) return
      if (fetched && !isRepostEvent(fetched)) {
        if (fetched.kind === kinds.Zap && !(await lightning.validateZapReceipt(fetched))) return
        setTargetEvent(fetched)
        threadService.addRepliesToThread([fetched])
      }
    }

    run().finally(() => {
      if (!cancelled) setIsResolving(false)
    })

    return () => {
      cancelled = true
    }
  }, [event])

  return { targetEvent, isResolving }
}
