import { Drawer, DrawerContent, DrawerOverlay } from '@/components/ui/drawer'
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover'
import { BIG_RELAY_URLS, LONG_PRESS_THRESHOLD } from '@/constants'
import { useStuff } from '@/hooks/useStuff'
import { useStuffStatsById } from '@/hooks/useStuffStatsById'
import {
  createExternalContentReactionDraftEvent,
  createReactionDraftEvent
} from '@/lib/draft-event'
import { useNostr } from '@/providers/NostrProvider'
import { useScreenSize } from '@/providers/ScreenSizeProvider'
import { useUserPreferences } from '@/providers/UserPreferencesProvider'
import { useUserTrust } from '@/providers/UserTrustProvider'
import client from '@/services/client.service'
import stuffStatsService from '@/services/stuff-stats.service'
import { TEmoji } from '@/types'
import { Loader, SmilePlus } from 'lucide-react'
import { Event } from 'nostr-tools'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Emoji from '../Emoji'
import EmojiPicker from '../EmojiPicker'
import SuggestedEmojis from '../SuggestedEmojis'
import { formatCount } from './utils'

export default function LikeButton({ stuff }: { stuff: Event | string }) {
  const { t } = useTranslation()
  const { isSmallScreen } = useScreenSize()
  const { pubkey, publish, checkLogin } = useNostr()
  const { meetsMinTrustScore } = useUserTrust()
  const { quickReaction, quickReactionEmoji } = useUserPreferences()
  const { event, externalContent, stuffKey } = useStuff(stuff)
  const [liking, setLiking] = useState(false)
  const [isEmojiReactionsOpen, setIsEmojiReactionsOpen] = useState(false)
  const [isPickerOpen, setIsPickerOpen] = useState(false)
  const [likeCount, setLikeCount] = useState(0)
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null)
  const isLongPressRef = useRef(false)
  const noteStats = useStuffStatsById(stuffKey)
  const myLastEmoji = useMemo(() => {
    const stats = noteStats || {}
    const myLike = stats.likes?.find((like) => like.pubkey === pubkey)
    return myLike?.emoji
  }, [noteStats, pubkey])

  useEffect(() => {
    const filterLikes = async () => {
      const stats = noteStats || {}
      const likes = stats.likes || []
      let count = 0
      await Promise.all(
        likes.map(async (like) => {
          if (await meetsMinTrustScore(like.pubkey)) {
            count++
          }
        })
      )
      setLikeCount(count)
    }
    filterLikes()
  }, [noteStats, meetsMinTrustScore])

  useEffect(() => {
    setTimeout(() => setIsPickerOpen(false), 100)
  }, [isEmojiReactionsOpen])

  const like = async (emoji: string | TEmoji) => {
    checkLogin(async () => {
      if (liking || !pubkey) return

      setLiking(true)
      const timer = setTimeout(() => setLiking(false), 10_000)

      try {
        if (!noteStats?.updatedAt) {
          await stuffStatsService.fetchStuffStats(stuffKey, pubkey)
        }

        const reaction = event
          ? createReactionDraftEvent(event, emoji)
          : createExternalContentReactionDraftEvent(externalContent, emoji)
        const seenOn = event ? client.getSeenEventRelayUrls(event.id) : BIG_RELAY_URLS
        const evt = await publish(reaction, { additionalRelayUrls: seenOn })
        stuffStatsService.updateStuffStatsByEvents([evt])
      } catch (error) {
        console.error('like failed', error)
      } finally {
        setLiking(false)
        clearTimeout(timer)
      }
    })
  }

  const handleLongPressStart = () => {
    if (!quickReaction) return
    isLongPressRef.current = false
    longPressTimerRef.current = setTimeout(() => {
      isLongPressRef.current = true
      setIsEmojiReactionsOpen(true)
    }, LONG_PRESS_THRESHOLD)
  }

  const handleLongPressEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
  }

  const handleClick = (e: React.MouseEvent | React.TouchEvent) => {
    if (quickReaction) {
      // If it was a long press, don't trigger the click action
      if (isLongPressRef.current) {
        isLongPressRef.current = false
        return
      }
      // Quick reaction mode: click to react with default emoji
      // Prevent dropdown from opening
      e.preventDefault()
      e.stopPropagation()
      like(quickReactionEmoji)
    } else {
      setIsEmojiReactionsOpen(true)
    }
  }

  const trigger = (
    <button
      className="flex items-center enabled:hover:text-primary gap-1 px-3 h-full text-muted-foreground"
      title={t('Like')}
      disabled={liking}
      onClick={handleClick}
      onMouseDown={handleLongPressStart}
      onMouseUp={handleLongPressEnd}
      onMouseLeave={handleLongPressEnd}
      onTouchStart={handleLongPressStart}
      onTouchEnd={handleLongPressEnd}
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
    <Popover open={isEmojiReactionsOpen} onOpenChange={(open) => setIsEmojiReactionsOpen(open)}>
      <PopoverAnchor asChild>{trigger}</PopoverAnchor>
      <PopoverContent side="top" className="p-0 w-fit border-0 shadow-lg">
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
      </PopoverContent>
    </Popover>
  )
}
