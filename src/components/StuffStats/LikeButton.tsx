import { Modal, ModalContent } from '@/components/ui/modal'
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover'
import { LONG_PRESS_THRESHOLD } from '@/constants'
import { useFilteredLikeCount } from '@/hooks/useFilteredLikeCount'
import { useStuff } from '@/hooks/useStuff'
import { useStuffStatsById } from '@/hooks/useStuffStatsById'
import {
  createExternalContentReactionDraftEvent,
  createReactionDraftEvent
} from '@/lib/draft-event'
import { formatError } from '@/lib/error'
import { getDefaultRelayUrls } from '@/lib/relay'
import { cn } from '@/lib/utils'
import { useNostr } from '@/providers/NostrProvider'
import { useScreenSize } from '@/providers/ScreenSizeProvider'
import { useUserPreferences } from '@/providers/UserPreferencesProvider'
import client from '@/services/client.service'
import stuffStatsService, { TStuffStats } from '@/services/stuff-stats.service'
import { TEmoji } from '@/types'
import { Loader, SmilePlus } from 'lucide-react'
import { Event } from 'nostr-tools'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import ExpressionPicker from '../ExpressionPicker'
import Emoji from '../Emoji'
import SuggestedEmojis from '../SuggestedEmojis'
import { formatCount } from './utils'

export default function LikeButton({ stuff }: { stuff: Event | string }) {
  const { t } = useTranslation()
  const { isSmallScreen } = useScreenSize()
  const { pubkey, publish, checkLogin } = useNostr()
  const { quickReaction, quickReactionEmoji } = useUserPreferences()
  const enableQuickReaction = quickReaction && !isSmallScreen
  const { event, externalContent, stuffKey } = useStuff(stuff)
  const [liking, setLiking] = useState(false)
  const [isEmojiReactionsOpen, setIsEmojiReactionsOpen] = useState(false)
  const [isPickerOpen, setIsPickerOpen] = useState(false)
  const likeCount = useFilteredLikeCount(stuffKey)
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const pressPositionRef = useRef<{ x: number; y: number } | null>(null)
  const isLongPressRef = useRef(false)
  const suppressPointerClickRef = useRef(false)
  const noteStats = useStuffStatsById(stuffKey)
  const latestReaction = useMemo(() => {
    if (!pubkey) return undefined
    let latest: TStuffStats['likes'][number] | undefined
    for (const reaction of noteStats?.likes ?? []) {
      if (reaction.pubkey === pubkey && (!latest || reaction.created_at >= latest.created_at)) {
        latest = reaction
      }
    }
    return latest
  }, [noteStats, pubkey])

  useEffect(() => {
    setTimeout(() => setIsPickerOpen(false), 100)
  }, [isEmojiReactionsOpen])

  useEffect(
    () => () => {
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current)
      pressPositionRef.current = null
      isLongPressRef.current = false
      suppressPointerClickRef.current = false
    },
    [enableQuickReaction]
  )

  useEffect(() => {
    const trigger = triggerRef.current
    if (!trigger) return
    // Cancel selection itself, leaving touchstart available for native scrolling.
    const preventSelection = (e: globalThis.Event) => e.preventDefault()
    trigger.addEventListener('selectstart', preventSelection)
    return () => {
      trigger.removeEventListener('selectstart', preventSelection)
    }
  }, [isSmallScreen])

  const like = async (emoji: string | TEmoji) => {
    checkLogin(async () => {
      if (liking || !pubkey) return

      setLiking(true)
      const timer = setTimeout(() => setLiking(false), 10_000)

      try {
        if (!noteStats?.updatedAt) {
          await stuffStatsService.fetchStuffStats(event ?? stuffKey, pubkey)
        }

        const reaction = event
          ? createReactionDraftEvent(event, emoji)
          : createExternalContentReactionDraftEvent(externalContent, emoji)
        const seenOn = event ? client.getSeenEventRelayUrls(event.id) : getDefaultRelayUrls()
        const evt = await publish(reaction, { additionalRelayUrls: seenOn })
        stuffStatsService.updateStuffStatsByEvents([evt])
      } catch (error) {
        const errors = formatError(error)
        errors.forEach((err) => {
          toast.error(`${t('Failed to like')}: ${err}`, { duration: 10_000 })
        })
      } finally {
        setLiking(false)
        clearTimeout(timer)
      }
    })
  }

  const handleLongPressStart = (e: React.PointerEvent<HTMLButtonElement>) => {
    // Use one pointer sequence: compatibility mousedown after touchend must
    // not reset the long-press flag and send the default reaction.
    if (!enableQuickReaction || !e.isPrimary || e.button !== 0) return
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current)
    pressPositionRef.current = { x: e.clientX, y: e.clientY }
    isLongPressRef.current = false
    suppressPointerClickRef.current = false
    longPressTimerRef.current = setTimeout(() => {
      isLongPressRef.current = true
      setIsEmojiReactionsOpen(true)
    }, LONG_PRESS_THRESHOLD)
  }

  const handleLongPressEnd = () => {
    pressPositionRef.current = null
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
  }

  const handleLongPressMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const start = pressPositionRef.current
    if (start && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 8) {
      handleLongPressEnd()
    }
  }

  const handlePointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    handleLongPressMove(e)
    suppressPointerClickRef.current = isLongPressRef.current
    isLongPressRef.current = false
    handleLongPressEnd()
  }

  const handlePointerCancel = () => {
    suppressPointerClickRef.current = isLongPressRef.current
    isLongPressRef.current = false
    handleLongPressEnd()
  }

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (enableQuickReaction) {
      // A long press may end without a click. Keep late pointer-click suppression
      // separate so it cannot consume a keyboard or assistive activation (detail=0).
      if (e.detail !== 0 && (isLongPressRef.current || suppressPointerClickRef.current)) {
        suppressPointerClickRef.current = false
        e.preventDefault()
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
      ref={triggerRef}
      className={cn(
        'flex h-full cursor-pointer items-center gap-1 px-3 select-none [-webkit-touch-callout:none] enabled:hover:text-red-400',
        latestReaction ? 'text-red-400' : 'text-muted-foreground'
      )}
      title={t('Like')}
      disabled={liking}
      onClick={handleClick}
      onContextMenu={(e) => e.preventDefault()}
      onPointerDown={handleLongPressStart}
      onPointerMove={handleLongPressMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handleLongPressEnd}
      onPointerCancel={handlePointerCancel}
    >
      {liking ? (
        <Loader className="animate-spin" />
      ) : (
        <>
          {latestReaction ? (
            <span
              className={cn(
                'flex shrink-0 items-center justify-center overflow-hidden leading-none',
                isSmallScreen ? 'size-5 text-lg' : 'size-4 text-base'
              )}
            >
              <Emoji
                key={latestReaction.id}
                emoji={latestReaction.emoji}
                classNames={{ img: 'size-full rounded-sm object-contain' }}
              />
            </span>
          ) : (
            <SmilePlus />
          )}
          {!!likeCount && <div className="text-sm">{formatCount(likeCount)}</div>}
        </>
      )}
    </button>
  )

  if (isSmallScreen) {
    return (
      <>
        {trigger}
        <Modal open={isEmojiReactionsOpen} onOpenChange={setIsEmojiReactionsOpen}>
          <ModalContent title={t('React')}>
            <ExpressionPicker
              onEmojiClick={(emoji) => {
                setIsEmojiReactionsOpen(false)
                if (!emoji) return

                like(emoji)
              }}
            />
          </ModalContent>
        </Modal>
      </>
    )
  }

  return (
    <Popover open={isEmojiReactionsOpen} onOpenChange={(open) => setIsEmojiReactionsOpen(open)}>
      <PopoverAnchor asChild>{trigger}</PopoverAnchor>
      <PopoverContent side="top" className="w-fit overflow-hidden p-0 shadow-lg">
        {isPickerOpen ? (
          <ExpressionPicker
            onEmojiClick={(emoji) => {
              setIsEmojiReactionsOpen(false)
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
