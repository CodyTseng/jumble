import { SPECIAL_TRUST_SCORE_FILTER_ID } from '@/constants'
import { getEventKey, isMentioningMutedUsers } from '@/lib/event'
import { useContentPolicy } from '@/providers/ContentPolicyProvider'
import { useMuteList } from '@/providers/MuteListProvider'
import { useNostr } from '@/providers/NostrProvider'
import { useUserTrust } from '@/providers/UserTrustProvider'
import { NostrEvent } from 'nostr-tools'
import { useEffect, useMemo, useState } from 'react'
import { useFetchEvents } from './useFetchEvent'
import { useAllDescendantThreads } from './useThread'

function collectReplyIds(threads: Map<string, string[]>): string[] {
  const ids = new Set<string>()
  for (const childIds of threads.values()) {
    childIds.forEach((id) => ids.add(id))
  }
  return Array.from(ids)
}

export function useFilteredReplies(stuffKey: string) {
  const { pubkey } = useNostr()
  const { getMinTrustScore, meetsMinTrustScore } = useUserTrust()
  const { mutePubkeySet } = useMuteList()
  const { hideContentMentioningMutedUsers } = useContentPolicy()
  const allThreads = useAllDescendantThreads(stuffKey)
  const allReplyIds = useMemo(() => collectReplyIds(allThreads), [allThreads])
  const { eventsById, isFetching } = useFetchEvents(allReplyIds)
  const [replies, setReplies] = useState<NostrEvent[]>([])
  const [hasReplied, setHasReplied] = useState(false)

  useEffect(() => {
    let cancelled = false
    const filterReplies = async () => {
      const replyKeySet = new Set<string>()
      const threadIds = allThreads.get(stuffKey) || []
      const filtered: NostrEvent[] = []

      const trustScoreThreshold = getMinTrustScore(SPECIAL_TRUST_SCORE_FILTER_ID.INTERACTIONS)
      await Promise.all(
        threadIds.map(async (id) => {
          const evt = eventsById.get(id)
          if (!evt) return
          const key = getEventKey(evt)
          if (replyKeySet.has(key)) return
          replyKeySet.add(key)

          if (mutePubkeySet.has(evt.pubkey)) return
          if (hideContentMentioningMutedUsers && isMentioningMutedUsers(evt, mutePubkeySet)) return

          const meetsTrust = await meetsMinTrustScore(evt.pubkey, trustScoreThreshold)
          if (!meetsTrust) {
            const replyKey = getEventKey(evt)
            const repliesForThisReply = (allThreads.get(replyKey) ?? []).flatMap((id) =>
              eventsById.get(id) ? [eventsById.get(id)!] : []
            )
            // If the reply is not trusted, check if there are any trusted replies for this reply
            if (repliesForThisReply && repliesForThisReply.length > 0) {
              let hasTrustedReply = false
              for (const reply of repliesForThisReply) {
                if (await meetsMinTrustScore(reply.pubkey, trustScoreThreshold)) {
                  hasTrustedReply = true
                  break
                }
              }
              if (!hasTrustedReply) return
            } else {
              return
            }
          }
          filtered.push(evt)
        })
      )

      filtered.sort((a, b) => b.created_at - a.created_at)
      if (!cancelled) setReplies(filtered)
    }

    filterReplies()
    return () => {
      cancelled = true
    }
  }, [
    stuffKey,
    allThreads,
    eventsById,
    mutePubkeySet,
    hideContentMentioningMutedUsers,
    getMinTrustScore,
    meetsMinTrustScore
  ])

  useEffect(() => {
    let replied = false
    for (const reply of replies) {
      if (reply.pubkey === pubkey) {
        replied = true
        break
      }
    }
    setHasReplied(replied)
  }, [replies, pubkey])

  return { replies, hasReplied, isLoading: isFetching }
}

export function useFilteredAllReplies(stuffKey: string) {
  const { pubkey } = useNostr()
  const allThreads = useAllDescendantThreads(stuffKey)
  const { getMinTrustScore, meetsMinTrustScore } = useUserTrust()
  const { mutePubkeySet } = useMuteList()
  const { hideContentMentioningMutedUsers } = useContentPolicy()
  const allReplyIds = useMemo(() => collectReplyIds(allThreads), [allThreads])
  const { eventsById, isFetching } = useFetchEvents(allReplyIds)
  const [replies, setReplies] = useState<NostrEvent[]>([])
  const [hasReplied, setHasReplied] = useState(false)

  useEffect(() => {
    let cancelled = false
    const filterReplies = async () => {
      const replyKeySet = new Set<string>()
      const replyEvents: NostrEvent[] = []
      const trustScoreThreshold = getMinTrustScore(SPECIAL_TRUST_SCORE_FILTER_ID.INTERACTIONS)

      await Promise.all(
        allReplyIds.map(async (id) => {
          const evt = eventsById.get(id)
          if (!evt) return
          const key = getEventKey(evt)
          if (replyKeySet.has(key)) return
          replyKeySet.add(key)

          if (mutePubkeySet.has(evt.pubkey)) return
          if (hideContentMentioningMutedUsers && isMentioningMutedUsers(evt, mutePubkeySet)) return

          const meetsTrust = await meetsMinTrustScore(evt.pubkey, trustScoreThreshold)
          if (!meetsTrust) {
            const repliesForThisReply = (allThreads.get(key) ?? []).flatMap((childId) =>
              eventsById.get(childId) ? [eventsById.get(childId)!] : []
            )
            // If the reply is not trusted, check if there are any trusted replies for this reply
            if (repliesForThisReply.length > 0) {
              let hasTrustedReply = false
              for (const reply of repliesForThisReply) {
                if (await meetsMinTrustScore(reply.pubkey, trustScoreThreshold)) {
                  hasTrustedReply = true
                  break
                }
              }
              if (!hasTrustedReply) return
            } else {
              return
            }
          }

          replyEvents.push(evt)
        })
      )
      if (!cancelled) setReplies(replyEvents.sort((a, b) => a.created_at - b.created_at))
    }

    filterReplies()
    return () => {
      cancelled = true
    }
  }, [
    allThreads,
    allReplyIds,
    eventsById,
    mutePubkeySet,
    hideContentMentioningMutedUsers,
    getMinTrustScore,
    meetsMinTrustScore
  ])

  useEffect(() => {
    let replied = false
    for (const reply of replies) {
      if (reply.pubkey === pubkey) {
        replied = true
        break
      }
    }
    setHasReplied(replied)
  }, [replies, pubkey])

  return { replies, hasReplied, isLoading: isFetching }
}
