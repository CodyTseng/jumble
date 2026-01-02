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

export default function ReplyNoteList({ stuff }: { stuff: NEvent | string }) {
  const { t } = useTranslation()
  const { stuffKey } = useStuff(stuff)
  const [initialLoading, setInitialLoading] = useState(false)
  const { replies } = useFilteredReplies(stuffKey)

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
    initialLoading
  })

  return (
    <div className="min-h-[80vh]">
      {(loading || initialLoading) && <LoadingBar />}
      <div>
        {visibleItems.map((reply) => (
          <Item key={reply.id} reply={reply} />
        ))}
      </div>
      <div ref={bottomRef} />
      {shouldShowLoadingIndicator ? (
        <ReplyNoteSkeleton />
      ) : (
        <div className="text-sm mt-2 mb-3 text-center text-muted-foreground">
          {replies.length > 0 ? t('no more replies') : t('no replies')}
        </div>
      )}
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
