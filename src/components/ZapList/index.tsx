import { useSecondaryPage } from '@/PageManager'
import { useNoteStatsById } from '@/hooks/useNoteStatsById'
import { formatAmount } from '@/lib/lightning'
import { toProfile } from '@/lib/link'
import { useScreenSize } from '@/providers/ScreenSizeProvider'
import { Zap } from 'lucide-react'
import { Event } from 'nostr-tools'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Content from '../Content'
import { FormattedTimestamp } from '../FormattedTimestamp'
import Nip05 from '../Nip05'
import UserAvatar from '../UserAvatar'
import Username from '../Username'

const SHOW_COUNT = 20

export default function ZapList({ event }: { event: Event }) {
  const { t } = useTranslation()
  const { push } = useSecondaryPage()
  const { isSmallScreen } = useScreenSize()
  const noteStats = useNoteStatsById(event.id)
  const filteredZaps = useMemo(() => {
    return (noteStats?.zaps ?? []).sort((a, b) => b.amount - a.amount)
  }, [noteStats, event.id])

  const [showCount, setShowCount] = useState(SHOW_COUNT)
  const bottomRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!bottomRef.current || filteredZaps.length <= showCount) return
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setShowCount((c) => c + SHOW_COUNT)
      },
      { rootMargin: '10px', threshold: 0.1 }
    )
    obs.observe(bottomRef.current)
    return () => obs.disconnect()
  }, [filteredZaps.length, showCount])

  return (
    <div className="min-h-[80vh]">
      {filteredZaps.slice(0, showCount).map((zap) => (
        <div
          key={zap.pr}
          className="px-4 py-3 border-b transition-colors clickable flex gap-2"
          onClick={() => push(toProfile(zap.pubkey))}
        >
          <div className="w-8 flex flex-col items-center mt-0.5">
            <Zap className="text-yellow-400 size-5" />
            <div className="text-sm font-semibold text-yellow-400">{formatAmount(zap.amount)}</div>
          </div>

          <div className="flex space-x-2 items-start">
            <UserAvatar userId={zap.pubkey} size="medium" className="shrink-0 mt-0.5" />
            <div className="flex-1">
              <Username
                userId={zap.pubkey}
                className="text-sm font-semibold text-muted-foreground hover:text-foreground max-w-fit truncate"
                skeletonClassName="h-3"
              />
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <Nip05 pubkey={zap.pubkey} append="·" />
                <FormattedTimestamp
                  timestamp={zap.created_at}
                  className="shrink-0"
                  short={isSmallScreen}
                />
              </div>
              <Content className="mt-2" content={zap.comment} />
            </div>
          </div>
        </div>
      ))}

      <div ref={bottomRef} />

      <div className="text-sm mt-2 text-center text-muted-foreground">
        {filteredZaps.length > 0 ? t('No more zaps') : t('No zaps yet')}
      </div>
    </div>
  )
}
