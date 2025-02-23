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
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import PostEditor from '../PostEditor'
import { formatCount } from './utils'

export default function RepostButton({ event }: { event: Event }) {
  const { t } = useTranslation()
  const { publish, checkLogin, pubkey } = useNostr()
  const { noteStatsMap, updateNoteStatsByEvents, fetchNoteStats } = useNoteStats()
  const [reposting, setReposting] = useState(false)
  const [isPostDialogOpen, setIsPostDialogOpen] = useState(false)
  const { repostCount, hasReposted } = useMemo(() => {
    const stats = noteStatsMap.get(event.id) || {}
    return {
      repostCount: stats.reposts?.size,
      hasReposted: pubkey ? stats.reposts?.has(pubkey) : false
    }
  }, [noteStatsMap, event.id])
  const canRepost = !hasReposted && !reposting

  const repost = async (e: React.MouseEvent) => {
    e.stopPropagation()
    checkLogin(async () => {
      if (!canRepost || !pubkey) return

      setReposting(true)
      const timer = setTimeout(() => setReposting(false), 5000)

      try {
        const noteStats = noteStatsMap.get(event.id)
        const hasReposted = noteStats?.reposts?.has(pubkey)
        if (hasReposted) return
        if (!noteStats?.updatedAt) {
          const stats = await fetchNoteStats(event)
          if (stats?.reposts?.has(pubkey)) return
        }

        const targetRelayList = await client.fetchRelayList(event.pubkey)
        const repost = createRepostDraftEvent(event)
        const evt = await publish(repost, { additionalRelayUrls: targetRelayList.read.slice(0, 5) })
        updateNoteStatsByEvents([evt])
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
