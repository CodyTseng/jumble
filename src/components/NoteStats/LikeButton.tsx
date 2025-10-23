import { Drawer, DrawerContent, DrawerOverlay } from '@/components/ui/drawer'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { useNoteStatsById } from '@/hooks/useNoteStatsById'
import { createReactionDraftEvent } from '@/lib/draft-event'
import { useNostr } from '@/providers/NostrProvider'
import { useScreenSize } from '@/providers/ScreenSizeProvider'
import { useUserTrust } from '@/providers/UserTrustProvider'
import client from '@/services/client.service'
import noteStatsService from '@/services/note-stats.service'
import { TEmoji } from '@/types'
import { Loader, SmilePlus } from 'lucide-react'
import { Event } from 'nostr-tools'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Emoji from '../Emoji'
import EmojiPicker from '../EmojiPicker'
import SuggestedEmojis from '../SuggestedEmojis'
import { formatCount } from './utils'

export default function LikeButton({ event }: { event: Event }) {
  const { t } = useTranslation()
  const { isSmallScreen } = useScreenSize()
  const { pubkey, publish, checkLogin } = useNostr()
  const { hideUntrustedInteractions, isUserTrusted } = useUserTrust()
  const [liking, setLiking] = useState(false)
  const [isEmojiReactionsOpen, setIsEmojiReactionsOpen] = useState(false)
  const [isPickerOpen, setIsPickerOpen] = useState(false)
  const noteStats = useNoteStatsById(event.id)
  const { myLastEmoji, likeCount } = useMemo(() => {
    const stats = noteStats || {}
    const myLike = stats.likes?.find((like) => like.pubkey === pubkey)
    const likes = hideUntrustedInteractions
      ? stats.likes?.filter((like) => isUserTrusted(like.pubkey))
      : stats.likes
    return { myLastEmoji: myLike?.emoji, likeCount: likes?.length }
  }, [noteStats, pubkey, hideUntrustedInteractions])

  const like = async (emoji: string | TEmoji) => {
    checkLogin(async () => {
      if (liking || !pubkey) return

      setLiking(true)
      const timer = setTimeout(() => setLiking(false), 10_000)

      try {
        if (!noteStats?.updatedAt) {
          await noteStatsService.fetchNoteStats(event, pubkey)
        }

        const reaction = createReactionDraftEvent(event, emoji)
        const seenOn = client.getSeenEventRelayUrls(event.id)
        const evt = await publish(reaction, { additionalRelayUrls: seenOn })
        noteStatsService.updateNoteStatsByEvents([evt])
      } catch (error) {
        console.error('like failed', error)
      } finally {
        setLiking(false)
        clearTimeout(timer)
      }
    })
  }

  const trigger = (
    <button
      className="flex items-center enabled:hover:text-primary gap-1 px-3 h-full text-muted-foreground"
      title={t('Like')}
      disabled={liking}
      onClick={() => {
        if (isSmallScreen) {
          setIsEmojiReactionsOpen(true)
        }
      }}
    >
      {liking ? (
        <Loader className="animate-spin" />
      ) : myLastEmoji ? (
        <>
          <Emoji emoji={myLastEmoji} classNames={{ img: 'size-4' }} />
          {!!likeCount && <div className="text-sm">{formatCount(likeCount)}</div>}
        </>
      ) : (
        <>
          <SmilePlus />
          {!!likeCount && <div className="text-sm">{formatCount(likeCount)}</div>}
        </>
      )}
    </button>
  )

  if (isSmallScreen) {
    return (
      <>
        {trigger}
        <Drawer open={isEmojiReactionsOpen} onOpenChange={setIsEmojiReactionsOpen}>
          <DrawerOverlay onClick={() => setIsEmojiReactionsOpen(false)} />
          <DrawerContent hideOverlay>
            <EmojiPicker
              onEmojiClick={(emoji) => {
                setIsEmojiReactionsOpen(false)
                if (!emoji) return

                like(emoji)
              }}
            />
          </DrawerContent>
        </Drawer>
      </>
    )
  }

  return (
    <DropdownMenu
      open={isEmojiReactionsOpen}
      onOpenChange={(open) => {
        setIsEmojiReactionsOpen(open)
        if (open) {
          setIsPickerOpen(false)
        }
      }}
    >
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent side="top" className="p-0 w-fit">
        {isPickerOpen ? (
          <EmojiPicker
            onEmojiClick={(emoji, e) => {
              e.stopPropagation()
              setIsEmojiReactionsOpen(false)
              if (!emoji) return

              like(emoji)
            }}
          />
        ) : (
          <SuggestedEmojis
            onEmojiClick={(emoji) => {
              setIsEmojiReactionsOpen(false)
              like(emoji)
            }}
            onMoreButtonClick={() => {
              setIsPickerOpen(true)
            }}
          />
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
