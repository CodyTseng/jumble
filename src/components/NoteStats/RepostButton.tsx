import { Button } from '@/components/ui/button'
import { Drawer, DrawerContent, DrawerOverlay } from '@/components/ui/drawer'
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
import { useScreenSize } from '@/providers/ScreenSizeProvider'
import { Loader, PencilLine, Repeat } from 'lucide-react'
import { Event } from 'nostr-tools'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import PostEditor from '../PostEditor'
import { formatCount } from './utils'

export default function RepostButton({ event }: { event: Event }) {
  const { t } = useTranslation()
  const { isSmallScreen } = useScreenSize()
  const { publish, checkLogin, pubkey } = useNostr()
  const { noteStatsMap, updateNoteStatsByEvents, fetchNoteStats } = useNoteStats()
  const [reposting, setReposting] = useState(false)
  const [isPostDialogOpen, setIsPostDialogOpen] = useState(false)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const { repostCount, hasReposted } = useMemo(() => {
    const stats = noteStatsMap.get(event.id) || {}
    return {
      repostCount: stats.reposts?.size,
      hasReposted: pubkey ? stats.reposts?.has(pubkey) : false
    }
  }, [noteStatsMap, event.id])
  const canRepost = !hasReposted && !reposting

  const repost = async () => {
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

        const repost = createRepostDraftEvent(event)
        const evt = await publish(repost)
        updateNoteStatsByEvents([evt])
      } catch (error) {
        console.error('repost failed', error)
      } finally {
        setReposting(false)
        clearTimeout(timer)
      }
    })
  }

  const trigger = (
    <button
      className={cn(
        'flex gap-1 items-center enabled:hover:text-lime-500 px-3 h-full',
        hasReposted ? 'text-lime-500' : 'text-muted-foreground'
      )}
      title={t('Repost')}
      onClick={() => {
        if (isSmallScreen) {
          setIsDrawerOpen(true)
        }
      }}
    >
      {reposting ? <Loader className="animate-spin" /> : <Repeat />}
      {!!repostCount && <div className="text-sm">{formatCount(repostCount)}</div>}
    </button>
  )

  const postEditor = (
    <PostEditor
      open={isPostDialogOpen}
      setOpen={setIsPostDialogOpen}
      defaultContent={'\nnostr:' + getSharableEventId(event)}
    />
  )

  if (isSmallScreen) {
    return (
      <>
        {trigger}
        <Drawer open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
          <DrawerOverlay onClick={() => setIsDrawerOpen(false)} />
          <DrawerContent hideOverlay>
            <div className="py-2">
              <Button
                onClick={(e) => {
                  e.stopPropagation()
                  setIsDrawerOpen(false)
                  repost()
                }}
                disabled={!canRepost}
                className="w-full p-6 justify-start text-lg gap-4 [&_svg]:size-5"
                variant="ghost"
              >
                <Repeat /> {t('Repost')}
              </Button>
              <Button
                onClick={(e) => {
                  e.stopPropagation()
                  setIsDrawerOpen(false)
                  checkLogin(() => {
                    setIsPostDialogOpen(true)
                  })
                }}
                className="w-full p-6 justify-start text-lg gap-4 [&_svg]:size-5"
                variant="ghost"
              >
                <PencilLine /> {t('Quote')}
              </Button>
            </div>
          </DrawerContent>
        </Drawer>
        {postEditor}
      </>
    )
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation()
              repost()
            }}
            disabled={!canRepost}
          >
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
      {postEditor}
    </>
  )
}
