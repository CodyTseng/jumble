import { getEventKey, isMentioningMutedUsers } from '@/lib/event'
import { useContentPolicy } from '@/providers/ContentPolicyProvider'
import { useMuteList } from '@/providers/MuteListProvider'
import { useNostr } from '@/providers/NostrProvider'
import { useUserTrust } from '@/providers/UserTrustProvider'
import { NostrEvent } from 'nostr-tools'
import { useEffect, useState } from 'react'
import { useAllDescendantThreads } from './useThread'

export function useFilteredReplies(stuffKey: string) {
  const { pubkey } = useNostr()
  const { minTrustScore, meetsMinTrustScore } = useUserTrust()
  const { mutePubkeySet } = useMuteList()
  const { hideContentMentioningMutedUsers } = useContentPolicy()
  const allThreads = useAllDescendantThreads(stuffKey)
  const [replies, setReplies] = useState<NostrEvent[]>([])
  const [hasReplied, setHasReplied] = useState(false)

  useEffect(() => {
    const filterReplies = async () => {
      const replyKeySet = new Set<string>()
      const thread = allThreads.get(stuffKey) || []
      const filtered: NostrEvent[] = []

      await Promise.all(
        thread.map(async (evt) => {
          const key = getEventKey(evt)
          if (replyKeySet.has(key)) return
          replyKeySet.add(key)

          if (mutePubkeySet.has(evt.pubkey)) return
          if (hideContentMentioningMutedUsers && isMentioningMutedUsers(evt, mutePubkeySet)) return

          const meetsTrust = await meetsMinTrustScore(evt.pubkey)
          if (!meetsTrust) {
            const replyKey = getEventKey(evt)
            const repliesForThisReply = allThreads.get(replyKey)
            // If the reply is not trusted, check if there are any trusted replies for this reply
            if (repliesForThisReply && repliesForThisReply.length > 0) {
              let hasTrustedReply = false
              for (const reply of repliesForThisReply) {
                if (await meetsMinTrustScore(reply.pubkey)) {
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
      setReplies(filtered)
    }

    filterReplies()
  }, [
    stuffKey,
    allThreads,
    mutePubkeySet,
    hideContentMentioningMutedUsers,
    minTrustScore,
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

  return { replies, hasReplied }
}

export function useFilteredAllReplies(stuffKey: string) {
  const { pubkey } = useNostr()
  const allThreads = useAllDescendantThreads(stuffKey)
  const { minTrustScore, meetsMinTrustScore } = useUserTrust()
  const { mutePubkeySet } = useMuteList()
  const { hideContentMentioningMutedUsers } = useContentPolicy()
  const [replies, setReplies] = useState<NostrEvent[]>([])
  const [hasReplied, setHasReplied] = useState(false)

  useEffect(() => {
    const filterReplies = async () => {
      const replyKeySet = new Set<string>()
      const replyEvents: NostrEvent[] = []

      let parentKeys = [stuffKey]
      while (parentKeys.length > 0) {
        const events = parentKeys.flatMap((key) => allThreads.get(key) ?? [])
        await Promise.all(
          events.map(async (evt) => {
            const key = getEventKey(evt)
            if (replyKeySet.has(key)) return
            replyKeySet.add(key)

            if (mutePubkeySet.has(evt.pubkey)) return
            if (hideContentMentioningMutedUsers && isMentioningMutedUsers(evt, mutePubkeySet))
              return

            const meetsTrust = await meetsMinTrustScore(evt.pubkey)
            if (!meetsTrust) {
              const replyKey = getEventKey(evt)
              const repliesForThisReply = allThreads.get(replyKey)
              // If the reply is not trusted, check if there are any trusted replies for this reply
              if (repliesForThisReply && repliesForThisReply.length > 0) {
                let hasTrustedReply = false
                for (const reply of repliesForThisReply) {
                  if (await meetsMinTrustScore(reply.pubkey)) {
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
        parentKeys = events.map((evt) => getEventKey(evt))
      }
      setReplies(replyEvents.sort((a, b) => a.created_at - b.created_at))
    }

    filterReplies()
  }, [
    stuffKey,
    allThreads,
    mutePubkeySet,
    hideContentMentioningMutedUsers,
    minTrustScore,
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

  return { replies, hasReplied }
}
