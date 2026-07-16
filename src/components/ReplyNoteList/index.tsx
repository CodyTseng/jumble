import { useFilteredReplies } from '@/hooks'
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll'
import { useStuff } from '@/hooks/useStuff'
import { getEventKey } from '@/lib/event'
import threadService from '@/services/thread.service'
import { Event as NEvent } from 'nostr-tools'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LoadingBar } from '../LoadingBar'
import ReplyNote, { ReplyNoteSkeleton } from '../ReplyNote'
import SubReplies from './SubReplies'

const LIMIT = 100
const SHOW_COUNT = 10

export default function ReplyNoteList({
  stuff,
  opPubkey
}: {
  stuff: NEvent | string
  opPubkey?: string
}) {
  const { t } = useTranslation()
  const { stuffKey } = useStuff(stuff)
  const [initialLoading, setInitialLoading] = useState(false)
  const { replies, isLoading: isHydratingReplies } = useFilteredReplies(stuffKey)
  const isReplyLoading = initialLoading || isHydratingReplies

  // Initial subscription
  useEffect(() => {
    const loadInitial = async () => {
      setInitialLoading(true)
      await threadService.subscribe(stuff, LIMIT)
      setInitialLoading(false)
    }

    loadInitial()

    return () => {
      threadService.unsubscribe(stuff)
    }
  }, [stuff])

  const handleLoadMore = useCallback(async () => {
    return await threadService.loadMore(stuff, LIMIT)
  }, [stuff])

  const { visibleItems, loading, shouldShowLoadingIndicator, bottomRef } = useInfiniteScroll({
    items: replies,
    showCount: SHOW_COUNT,
    onLoadMore: handleLoadMore,
    initialLoading: isReplyLoading
  })

  return (
    <div className="min-h-[80vh]">
      {(loading || isReplyLoading) && <LoadingBar />}
      <div>
        {visibleItems.map((reply) => (
          <Item key={reply.id} reply={reply} opPubkey={opPubkey} />
        ))}
      </div>
      <div ref={bottomRef} />
      {shouldShowLoadingIndicator ? (
        <ReplyNoteSkeleton />
      ) : (
        <div className="text-muted-foreground mt-2 mb-3 text-center text-sm">
          {replies.length > 0 ? t('no more replies') : t('no replies')}
        </div>
      )}
    </div>
  )
}

function Item({ reply, opPubkey }: { reply: NEvent; opPubkey?: string }) {
  const key = useMemo(() => getEventKey(reply), [reply])

  return (
    <div className="relative border-b">
      <ReplyNote event={reply} opPubkey={opPubkey} />
      <SubReplies parentKey={key} opPubkey={opPubkey} />
    </div>
  )
}
