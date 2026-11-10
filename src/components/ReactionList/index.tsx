import { useSecondaryPage } from '@/PageManager'
import { useFilteredLikes } from '@/hooks/useFilteredLikes'
import { useStuff } from '@/hooks/useStuff'
import { toNote } from '@/lib/link'
import { useScreenSize } from '@/providers/ScreenSizeProvider'
import { Event } from 'nostr-tools'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import ClickableCard from '../ClickableCard'
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
  const { stuffKey } = useStuff(stuff)
  const likes = useFilteredLikes(stuffKey)
  const filteredLikes = useMemo(
    () => [...likes].sort((a, b) => b.created_at - a.created_at),
    [likes]
  )

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
        <ClickableCard
          key={like.id}
          className="clickable flex items-center gap-3 border-b px-4 py-3 transition-colors"
          onClick={() => push(toNote(like.eventId))}
        >
          <div className="flex w-6 flex-col items-center">
            <Emoji
              emoji={like.emoji}
              clickable
              classNames={{
                text: 'text-xl'
              }}
            />
          </div>

          <UserAvatar userId={like.pubkey} size="medium" className="shrink-0" />

          <div className="w-0 flex-1">
            <Username
              userId={like.pubkey}
              className="text-muted-foreground hover:text-foreground max-w-fit truncate text-sm font-semibold"
              skeletonClassName="h-3"
            />
            <div className="text-muted-foreground flex items-center gap-1 text-sm">
              <Nip05 pubkey={like.pubkey} append="·" />
              <FormattedTimestamp
                timestamp={like.created_at}
                className="shrink-0"
                short={isSmallScreen}
              />
            </div>
          </div>
        </ClickableCard>
      ))}

      <div ref={bottomRef} />

      <div className="text-muted-foreground mt-2 text-center text-sm">
        {filteredLikes.length > 0 ? t('No more reactions') : t('No reactions yet')}
      </div>
    </div>
  )
}
