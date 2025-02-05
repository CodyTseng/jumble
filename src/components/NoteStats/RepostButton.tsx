import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { createRepostDraftEvent } from '@/lib/draft-event'
import { getSharableEventId } from '@/lib/event'
import { cn } from '@/lib/utils'
import { useNostr } from '@/providers/NostrProvider'
import { useNoteStats } from '@/providers/NoteStatsProvider'
import client from '@/services/client.service'
import { Loader, PencilLine, Repeat } from 'lucide-react'
import { Event } from 'nostr-tools'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import PostEditor from '../PostEditor'
import { formatCount } from './utils'

export default function RepostButton({
  event,
  canFetch = false
}: {
  event: Event
  canFetch?: boolean
}) {
  const { t } = useTranslation()
  const { publish, checkLogin } = useNostr()
  const { noteStatsMap, fetchNoteRepostCount, fetchNoteRepostedStatus, markNoteAsReposted } =
    useNoteStats()
  const [reposting, setReposting] = useState(false)
  const [isPostDialogOpen, setIsPostDialogOpen] = useState(false)
  const { repostCount, hasReposted } = useMemo(
    () => noteStatsMap.get(event.id) ?? {},
    [noteStatsMap, event.id]
  )
  const canRepost = !hasReposted && !reposting

  useEffect(() => {
    if (!canFetch) return

    if (repostCount === undefined) {
      fetchNoteRepostCount(event)
    }
    if (hasReposted === undefined) {
      fetchNoteRepostedStatus(event)
    }
  }, [canFetch, event])

  const repost = async (e: React.MouseEvent) => {
    e.stopPropagation()
    checkLogin(async () => {
      if (!canRepost) return

      setReposting(true)
      const timer = setTimeout(() => setReposting(false), 5000)

      try {
        const [reposted] = await Promise.all([
          hasReposted === undefined ? fetchNoteRepostedStatus(event) : hasReposted,
          repostCount === undefined ? fetchNoteRepostCount(event) : repostCount
        ])
        if (reposted) return

        const targetRelayList = await client.fetchRelayList(event.pubkey)
        const repost = createRepostDraftEvent(event)
        await publish(repost, { additionalRelayUrls: targetRelayList.read.slice(0, 5) })
        markNoteAsReposted(event.id)
      } catch (error) {
        console.error('repost failed', error)
      } finally {
        setReposting(false)
        clearTimeout(timer)
      }
    })
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className={cn(
              'flex gap-1 items-center enabled:hover:text-lime-500',
              hasReposted ? 'text-lime-500' : 'text-muted-foreground'
            )}
            title={t('Repost')}
          >
            {reposting ? <Loader className="animate-spin" size={16} /> : <Repeat size={16} />}
            {!!repostCount && <div className="text-sm">{formatCount(repostCount)}</div>}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onClick={repost} disabled={!canRepost}>
            <Repeat /> {t('Repost')}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation()
              checkLogin(() => {
                setIsPostDialogOpen(true)
              })
            }}
          >
            <PencilLine /> {t('Quote')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <PostEditor
        open={isPostDialogOpen}
        setOpen={setIsPostDialogOpen}
        defaultContent={'\nnostr:' + getSharableEventId(event)}
      />
    </>
  )
}
