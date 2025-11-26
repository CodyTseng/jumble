import {
  ResponsiveMenu,
  ResponsiveMenuContent,
  ResponsiveMenuItem,
  ResponsiveMenuTrigger
} from '@/components/ui/responsive-menu'
import { useStuff } from '@/hooks/useStuff'
import { useStuffStatsById } from '@/hooks/useStuffStatsById'
import { createRepostDraftEvent } from '@/lib/draft-event'
import { getNoteBech32Id } from '@/lib/event'
import { cn } from '@/lib/utils'
import { useNostr } from '@/providers/NostrProvider'
import { useUserTrust } from '@/providers/UserTrustProvider'
import stuffStatsService from '@/services/stuff-stats.service'
import { Loader, PencilLine, Repeat } from 'lucide-react'
import { Event } from 'nostr-tools'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import PostEditor from '../PostEditor'
import { formatCount } from './utils'

export default function RepostButton({ stuff }: { stuff: Event | string }) {
  const { t } = useTranslation()
  const { hideUntrustedInteractions, isUserTrusted } = useUserTrust()
  const { publish, checkLogin, pubkey } = useNostr()
  const { event, stuffKey } = useStuff(stuff)
  const noteStats = useStuffStatsById(stuffKey)
  const [reposting, setReposting] = useState(false)
  const [isPostDialogOpen, setIsPostDialogOpen] = useState(false)
  const [open, setOpen] = useState(false)
  const { repostCount, hasReposted } = useMemo(() => {
    // external content
    if (!event) return { repostCount: 0, hasReposted: false }

    return {
      repostCount: hideUntrustedInteractions
        ? noteStats?.reposts?.filter((repost) => isUserTrusted(repost.pubkey)).length
        : noteStats?.reposts?.length,
      hasReposted: pubkey ? noteStats?.repostPubkeySet?.has(pubkey) : false
    }
  }, [noteStats, event, hideUntrustedInteractions])
  const canRepost = !hasReposted && !reposting && !!event

  const repost = async () => {
    checkLogin(async () => {
      if (!canRepost || !pubkey) return

      setReposting(true)
      const timer = setTimeout(() => setReposting(false), 5000)

      try {
        const hasReposted = noteStats?.repostPubkeySet?.has(pubkey)
        if (hasReposted) return
        if (!noteStats?.updatedAt) {
          const noteStats = await stuffStatsService.fetchStuffStats(stuff, pubkey)
          if (noteStats.repostPubkeySet?.has(pubkey)) {
            return
          }
        }

        const repost = createRepostDraftEvent(event)
        const evt = await publish(repost)
        stuffStatsService.updateStuffStatsByEvents([evt])
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
      <ResponsiveMenu open={open} onOpenChange={setOpen}>
        <ResponsiveMenuTrigger asChild>
          <button
            className={cn(
              'flex gap-1 items-center px-3 h-full enabled:hover:text-lime-500 disabled:text-muted-foreground/40',
              hasReposted ? 'text-lime-500' : 'text-muted-foreground'
            )}
            disabled={!event}
            title={t('Repost')}
            onClick={(e) => {
              e.stopPropagation()
              if (!event) return
              setOpen(true)
            }}
          >
            {reposting ? <Loader className="animate-spin" /> : <Repeat />}
            {!!repostCount && <div className="text-sm">{formatCount(repostCount)}</div>}
          </button>
        </ResponsiveMenuTrigger>

        <ResponsiveMenuContent>
          <ResponsiveMenuItem
            onClick={(e) => {
              e?.stopPropagation()
              repost()
            }}
            disabled={!canRepost}
          >
            <Repeat /> {t('Repost')}
          </ResponsiveMenuItem>
          <ResponsiveMenuItem
            onClick={(e) => {
              e.stopPropagation()
              checkLogin(() => {
                setIsPostDialogOpen(true)
              })
            }}
          >
            <PencilLine /> {t('Quote')}
          </ResponsiveMenuItem>
        </ResponsiveMenuContent>
      </ResponsiveMenu>

      <PostEditor
        open={isPostDialogOpen}
        setOpen={setIsPostDialogOpen}
        defaultContent={event ? '\nnostr:' + getNoteBech32Id(event) : undefined}
      />
    </>
  )
}
