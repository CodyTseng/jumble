import { useSecondaryPage } from '@/PageManager'
import { useStuff } from '@/hooks/useStuff'
import { useStuffStatsById } from '@/hooks/useStuffStatsById'
import { toProfile } from '@/lib/link'
import { useScreenSize } from '@/providers/ScreenSizeProvider'
import { useUserTrust } from '@/providers/UserTrustProvider'
import { TEmoji } from '@/types'
import { Event } from 'nostr-tools'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Emoji from '../Emoji'
import { FormattedTimestamp } from '../FormattedTimestamp'
import Nip05 from '../Nip05'
import UserAvatar from '../UserAvatar'
import Username from '../Username'

const SHOW_COUNT = 20

export default function ReactionList({ stuff }: { stuff: Event | string }) {
  const { t } = useTranslation()
  const { push } = useSecondaryPage()
  const { isSmallScreen } = useScreenSize()
  const { minTrustScore, meetsMinTrustScore } = useUserTrust()
  const { stuffKey } = useStuff(stuff)
  const noteStats = useStuffStatsById(stuffKey)
  const [filteredLikes, setFilteredLikes] = useState<
    Array<{
      id: string
      pubkey: string
      emoji: string | TEmoji
      created_at: number
    }>
  >([])

  useEffect(() => {
    const filterLikes = async () => {
      const likes = noteStats?.likes ?? []
      const filtered: {
        id: string
        pubkey: string
        created_at: number
        emoji: string | TEmoji
      }[] = []
      await Promise.all(
        likes.map(async (like) => {
          if (await meetsMinTrustScore(like.pubkey)) {
            filtered.push(like)
          }
        })
      )
      filtered.sort((a, b) => b.created_at - a.created_at)
      setFilteredLikes(filtered)
    }
    filterLikes()
  }, [noteStats, stuffKey, minTrustScore, meetsMinTrustScore])

  const [showCount, setShowCount] = useState(SHOW_COUNT)
  const bottomRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!bottomRef.current || filteredLikes.length <= showCount) return
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setShowCount((c) => c + SHOW_COUNT)
      },
      { rootMargin: '10px', threshold: 0.1 }
    )
    obs.observe(bottomRef.current)
    return () => obs.disconnect()
  }, [filteredLikes.length, showCount])

  return (
    <div className="min-h-[80vh]">
      {filteredLikes.slice(0, showCount).map((like) => (
        <div
          key={like.id}
          className="px-4 py-3 border-b transition-colors clickable flex items-center gap-3"
          onClick={() => push(toProfile(like.pubkey))}
        >
          <div className="w-6 flex flex-col items-center">
            <Emoji
              emoji={like.emoji}
              classNames={{
                text: 'text-xl'
              }}
            />
          </div>

          <UserAvatar userId={like.pubkey} size="medium" className="shrink-0" />

          <div className="flex-1 w-0">
            <Username
              userId={like.pubkey}
              className="text-sm font-semibold text-muted-foreground hover:text-foreground max-w-fit truncate"
              skeletonClassName="h-3"
            />
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Nip05 pubkey={like.pubkey} append="·" />
              <FormattedTimestamp
                timestamp={like.created_at}
                className="shrink-0"
                short={isSmallScreen}
              />
            </div>
          </div>
        </div>
      ))}

      <div ref={bottomRef} />

      <div className="text-sm mt-2 text-center text-muted-foreground">
        {filteredLikes.length > 0 ? t('No more reactions') : t('No reactions yet')}
      </div>
    </div>
  )
}
