import { useMemo, useEffect, useState, useRef } from 'react'
import { useSecondaryPage } from '@/PageManager'
import { useUserTrust } from '@/providers/UserTrustProvider'
import { useNoteStatsById } from '@/hooks/useNoteStatsById'
import { useScreenSize } from '@/providers/ScreenSizeProvider'
import { useTranslation } from 'react-i18next'
import { LoadingBar } from '../LoadingBar'
import { cn } from '@/lib/utils'
import Collapsible from '../Collapsible'
import { FormattedTimestamp } from '../FormattedTimestamp'
import Emoji from '../Emoji'
import UserAvatar from '../UserAvatar'
import Username from '../Username'

const SHOW_COUNT = 10

export default function ReactionList({ index, event }: { index?: number; event: any }) {
  const { t } = useTranslation()
  const { isSmallScreen } = useScreenSize()
  const { currentIndex } = useSecondaryPage()
  const { hideUntrustedInteractions, isUserTrusted } = useUserTrust()

  const noteStats = useNoteStatsById(event.id)
  const likes = useMemo(() => noteStats?.likes ?? [], [noteStats, event.id])

  const filteredLikes = useMemo(
    () =>
      likes
        .filter((like) => !hideUntrustedInteractions || isUserTrusted(like.pubkey))
        .sort((a, b) => b.created_at - a.created_at),
    [likes, hideUntrustedInteractions, isUserTrusted]
  )

  const [showCount, setShowCount] = useState(SHOW_COUNT)
  const [loading, setLoading] = useState(true)
  const bottomRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (noteStats) {
      setLoading(false)
    }
  }, [noteStats])

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

  if (currentIndex !== index) return null

  return (
    <div>
      {loading && <LoadingBar />}

      {!loading && filteredLikes.length === 0 && (
        <div className="text-sm text-muted-foreground text-center my-4">
          {t('No reactions yet')}
        </div>
      )}

      {filteredLikes.slice(0, showCount).map((like, id) => (
        <div key={id} className="pb-3 border-b transition-colors duration-500 clickable">
          <Collapsible>
            <div className="flex items-center space-x-3 px-4 pt-3">
              <Emoji emoji={like.emoji} className="text-xl size-6" />

              <UserAvatar userId={like.pubkey} size="medium" className="shrink-0" />

              <div className="w-full overflow-hidden">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 w-0">
                    <div className="flex gap-1 items-center">
                      <Username
                        userId={like.pubkey}
                        className="text-sm font-semibold text-muted-foreground hover:text-foreground truncate"
                        skeletonClassName="h-3"
                      />
                    </div>
                    {like.created_at && (
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <FormattedTimestamp
                          timestamp={like.created_at}
                          className="shrink-0"
                          short={isSmallScreen}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </Collapsible>
        </div>
      ))}

      <div ref={bottomRef} />

      {!loading && filteredLikes.length > 0 && showCount >= filteredLikes.length && (
        <div className="text-sm mt-2 text-center text-muted-foreground">
          {t('no more reactions')}
        </div>
      )}
    </div>
  )
}
