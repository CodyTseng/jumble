import { useStuff } from '@/hooks/useStuff'
import { useAllDescendantThreads } from '@/hooks/useThread'
import { getEventKey, isMentioningMutedUsers } from '@/lib/event'
import { useContentPolicy } from '@/providers/ContentPolicyProvider'
import { useMuteList } from '@/providers/MuteListProvider'
import { useUserTrust } from '@/providers/UserTrustProvider'
import threadService from '@/services/thread.service'
import { Event as NEvent } from 'nostr-tools'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LoadingBar } from '../LoadingBar'
import ReplyNote, { ReplyNoteSkeleton } from '../ReplyNote'
import SubReplies from './SubReplies'

const LIMIT = 100
const SHOW_COUNT = 10

export default function ReplyNoteList({ stuff }: { stuff: NEvent | string }) {
  const { t } = useTranslation()
  const { hideUntrustedInteractions, isUserTrusted } = useUserTrust()
  const { mutePubkeySet } = useMuteList()
  const { hideContentMentioningMutedUsers } = useContentPolicy()
  const { stuffKey } = useStuff(stuff)
  const allThreads = useAllDescendantThreads(stuffKey)
  const replies = useMemo(() => {
    const replyKeySet = new Set<string>()
    const thread = allThreads.get(stuffKey) || []
    const replyEvents = thread.filter((evt) => {
      const key = getEventKey(evt)
      if (replyKeySet.has(key)) return false
      if (mutePubkeySet.has(evt.pubkey)) return false
      if (hideContentMentioningMutedUsers && isMentioningMutedUsers(evt, mutePubkeySet)) {
        return false
      }
      if (hideUntrustedInteractions && !isUserTrusted(evt.pubkey)) {
        const replyKey = getEventKey(evt)
        const repliesForThisReply = allThreads.get(replyKey)
        // If the reply is not trusted and there are no trusted replies for this reply, skip rendering
        if (
          !repliesForThisReply ||
          repliesForThisReply.every((evt) => !isUserTrusted(evt.pubkey))
        ) {
          return false
        }
      }

      replyKeySet.add(key)
      return true
    })
    return replyEvents.sort((a, b) => b.created_at - a.created_at)
  }, [
    stuffKey,
    allThreads,
    mutePubkeySet,
    hideContentMentioningMutedUsers,
    hideUntrustedInteractions
  ])
  const [hasMore, setHasMore] = useState(true)
  const [showCount, setShowCount] = useState(SHOW_COUNT)
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement | null>(null)
  const stateRef = useRef({ loading, hasMore, showCount, repliesLength: replies.length })
  stateRef.current = { loading, hasMore, showCount, repliesLength: replies.length }

  // Initial subscription
  useEffect(() => {
    setLoading(true)
    threadService.subscribe(stuff, LIMIT).finally(() => {
      setLoading(false)
    })

    return () => {
      threadService.unsubscribe(stuff)
    }
  }, [stuff])

  const loadMore = useCallback(async () => {
    const { loading, hasMore, showCount, repliesLength } = stateRef.current

    if (loading || !hasMore) return

    // If there are more items to show, increase showCount first
    if (showCount < repliesLength) {
      setShowCount((prev) => prev + SHOW_COUNT)
      // Only fetch more data when remaining items are running low
      if (repliesLength - showCount > LIMIT / 2) {
        return
      }
    }

    setLoading(true)
    const newHasMore = await threadService.loadMore(stuff, LIMIT)
    setHasMore(newHasMore)
    setLoading(false)
  }, [stuff])

  // IntersectionObserver setup
  useEffect(() => {
    const currentBottomRef = bottomRef.current
    if (!currentBottomRef) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMore()
        }
      },
      {
        root: null,
        rootMargin: '100px',
        threshold: 0
      }
    )

    observer.observe(currentBottomRef)

    return () => {
      observer.disconnect()
    }
  }, [loadMore])

  return (
    <div className="min-h-[80vh]">
      {loading && <LoadingBar />}
      <div>
        {replies.slice(0, showCount).map((reply) => (
          <Item key={reply.id} reply={reply} />
        ))}
      </div>
      {hasMore || showCount < replies.length || loading ? (
        <ReplyNoteSkeleton />
      ) : (
        <div className="text-sm mt-2 mb-3 text-center text-muted-foreground">
          {replies.length > 0 ? t('no more replies') : t('no replies')}
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  )
}

function Item({ reply }: { reply: NEvent }) {
  const key = useMemo(() => getEventKey(reply), [reply])

  return (
    <div className="relative border-b">
      <ReplyNote event={reply} />
      <SubReplies parentKey={key} />
    </div>
  )
}
