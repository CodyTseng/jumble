import { useSecondaryPage } from '@/PageManager'
import { useNoteStatsById } from '@/hooks/useNoteStatsById'
import { toProfile } from '@/lib/link'
import { useScreenSize } from '@/providers/ScreenSizeProvider'
import { useUserTrust } from '@/providers/UserTrustProvider'
import { Repeat } from 'lucide-react'
import { Event } from 'nostr-tools'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FormattedTimestamp } from '../FormattedTimestamp'
import Nip05 from '../Nip05'
import UserAvatar from '../UserAvatar'
import Username from '../Username'

const SHOW_COUNT = 20

export default function RepostList({ event }: { event: Event }) {
  const { t } = useTranslation()
  const { push } = useSecondaryPage()
  const { isSmallScreen } = useScreenSize()
  const { hideUntrustedInteractions, isUserTrusted } = useUserTrust()
  const noteStats = useNoteStatsById(event.id)
  const filteredReposts = useMemo(() => {
    return (noteStats?.reposts ?? [])
      .filter((repost) => !hideUntrustedInteractions || isUserTrusted(repost.pubkey))
      .sort((a, b) => b.created_at - a.created_at)
  }, [noteStats, event.id, hideUntrustedInteractions, isUserTrusted])

  const [showCount, setShowCount] = useState(SHOW_COUNT)
  const bottomRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!bottomRef.current || filteredReposts.length <= showCount) return
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setShowCount((c) => c + SHOW_COUNT)
      },
      { rootMargin: '10px', threshold: 0.1 }
    )
    obs.observe(bottomRef.current)
    return () => obs.disconnect()
  }, [filteredReposts.length, showCount])

  return (
    <div className="min-h-[80vh]">
      {filteredReposts.slice(0, showCount).map((repost) => (
        <div
          key={repost.id}
          className="px-4 py-3 border-b transition-colors clickable flex items-center gap-3"
          onClick={() => push(toProfile(repost.pubkey))}
        >
          <Repeat className="text-green-400 size-5" />

          <UserAvatar userId={repost.pubkey} size="medium" className="shrink-0" />

          <div className="flex-1 w-0">
            <Username
              userId={repost.pubkey}
              className="text-sm font-semibold text-muted-foreground hover:text-foreground max-w-fit truncate"
              skeletonClassName="h-3"
            />
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Nip05 pubkey={repost.pubkey} append="·" />
              <FormattedTimestamp
                timestamp={repost.created_at}
                className="shrink-0"
                short={isSmallScreen}
              />
            </div>
          </div>
        </div>
      ))}

      <div ref={bottomRef} />

      <div className="text-sm mt-2 text-center text-muted-foreground">
        {filteredReposts.length > 0 ? t('No more reposts') : t('No reposts yet')}
      </div>
    </div>
  )
}
