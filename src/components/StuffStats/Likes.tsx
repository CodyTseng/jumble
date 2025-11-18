import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { BIG_RELAY_URLS } from '@/constants'
import { useStuffStatsById } from '@/hooks/useStuffStatsById'
import { useStuff } from '@/hooks/useStuff'
import {
  createExternalContentReactionDraftEvent,
  createReactionDraftEvent
} from '@/lib/draft-event'
import { cn } from '@/lib/utils'
import { useNostr } from '@/providers/NostrProvider'
import client from '@/services/client.service'
import stuffStatsService from '@/services/stuff-stats.service'
import { TEmoji } from '@/types'
import { Loader } from 'lucide-react'
import { Event } from 'nostr-tools'
import { useMemo, useRef, useState } from 'react'
import Emoji from '../Emoji'

export default function Likes({ stuff }: { stuff: Event | string }) {
  const { pubkey, checkLogin, publish } = useNostr()
  const { event, externalContent, stuffKey } = useStuff(stuff)
  const noteStats = useStuffStatsById(stuffKey)
  const [liking, setLiking] = useState<string | null>(null)
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null)
  const [isLongPressing, setIsLongPressing] = useState<string | null>(null)
  const [isCompleted, setIsCompleted] = useState<string | null>(null)

  const likes = useMemo(() => {
    const _likes = noteStats?.likes
    if (!_likes) return []

    const stats = new Map<string, { key: string; emoji: TEmoji | string; pubkeys: Set<string> }>()
    _likes.forEach((item) => {
      const key = typeof item.emoji === 'string' ? item.emoji : item.emoji.url
      if (!stats.has(key)) {
        stats.set(key, { key, pubkeys: new Set(), emoji: item.emoji })
      }
      stats.get(key)?.pubkeys.add(item.pubkey)
    })
    return Array.from(stats.values()).sort((a, b) => b.pubkeys.size - a.pubkeys.size)
  }, [noteStats, event])

  if (!likes.length) return null

  const like = async (key: string, emoji: TEmoji | string) => {
    checkLogin(async () => {
      if (liking || !pubkey) return

      setLiking(key)
      const timer = setTimeout(() => setLiking((prev) => (prev === key ? null : prev)), 5000)

      try {
        const reaction = event
          ? createReactionDraftEvent(event, emoji)
          : createExternalContentReactionDraftEvent(externalContent, emoji)
        const seenOn = event ? client.getSeenEventRelayUrls(event.id) : BIG_RELAY_URLS
        const evt = await publish(reaction, { additionalRelayUrls: seenOn })
        stuffStatsService.updateStuffStatsByEvents([evt])
      } catch (error) {
        console.error('like failed', error)
      } finally {
        setLiking(null)
        clearTimeout(timer)
      }
    })
  }

  const handleMouseDown = (key: string) => {
    if (pubkey && likes.find((l) => l.key === key)?.pubkeys.has(pubkey)) {
      return
    }

    setIsLongPressing(key)
    longPressTimerRef.current = setTimeout(() => {
      setIsCompleted(key)
      setIsLongPressing(null)
    }, 800)
  }

  const handleMouseUp = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }

    if (isCompleted) {
      const completedKey = isCompleted
      const completedEmoji = likes.find((l) => l.key === completedKey)?.emoji
      if (completedEmoji) {
        like(completedKey, completedEmoji)
      }
    }

    setIsLongPressing(null)
    setIsCompleted(null)
  }

  const handleMouseLeave = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
    setIsLongPressing(null)
    setIsCompleted(null)
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    const touch = e.touches[0]
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const isInside =
      touch.clientX >= rect.left &&
      touch.clientX <= rect.right &&
      touch.clientY >= rect.top &&
      touch.clientY <= rect.bottom

    if (!isInside) {
      handleMouseLeave()
    }
  }

  return (
    <ScrollArea className="pb-2 mb-1">
      <div className="flex gap-1">
        {likes.map(({ key, emoji, pubkeys }) => (
          <div
            key={key}
            className={cn(
              'flex h-7 w-fit gap-2 px-2 rounded-full items-center border shrink-0 select-none relative overflow-hidden transition-all duration-200',
              pubkey && pubkeys.has(pubkey)
                ? 'border-primary bg-primary/20 text-foreground cursor-not-allowed'
                : 'bg-muted/80 text-muted-foreground cursor-pointer hover:bg-primary/40 hover:border-primary hover:text-foreground',
              (isLongPressing === key || isCompleted === key) && 'border-primary bg-primary/20'
            )}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={() => handleMouseDown(key)}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseLeave}
            onTouchStart={() => handleMouseDown(key)}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleMouseUp}
            onTouchCancel={handleMouseLeave}
          >
            {(isLongPressing === key || isCompleted === key) && (
              <div className="absolute inset-0 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-primary/40 via-primary/60 to-primary/80"
                  style={{
                    width: isCompleted === key ? '100%' : '0%',
                    animation:
                      isLongPressing === key ? 'progressFill 1000ms ease-out forwards' : 'none'
                  }}
                />
              </div>
            )}
            <div className="relative z-10 flex items-center gap-2">
              {liking === key ? (
                <Loader className="animate-spin size-4" />
              ) : (
                <div
                  style={{
                    animation: isCompleted === key ? 'shake 0.5s ease-in-out infinite' : undefined
                  }}
                >
                  <Emoji emoji={emoji} classNames={{ img: 'size-4' }} />
                </div>
              )}
              <div className="text-sm">{pubkeys.size}</div>
            </div>
          </div>
        ))}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  )
}
