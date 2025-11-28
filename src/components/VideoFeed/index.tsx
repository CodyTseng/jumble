import DivineVideoList, { TDivineVideoListRef } from '@/components/DivineVideoList'
import NoteList, { TNoteListRef } from '@/components/NoteList'
import { Button } from '@/components/ui/button'
import { ExtendedKind } from '@/constants'
import { DIVINE_RELAY_URL } from '@/lib/divine-video'
import { cn, isTouchDevice } from '@/lib/utils'
import { useNostr } from '@/providers/NostrProvider'
import { useUserTrust } from '@/providers/UserTrustProvider'
import client from '@/services/client.service'
import { TFeedSubRequest } from '@/types'
import { Flame, Globe, Users } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { RefreshButton } from '../RefreshButton'

// Video kinds
const VIDEO_KINDS = [
  ExtendedKind.VIDEO,
  ExtendedKind.SHORT_VIDEO,
  ExtendedKind.ADDRESSABLE_NORMAL_VIDEO,
  ExtendedKind.ADDRESSABLE_SHORT_VIDEO
]

type VideoSource = 'following' | 'global'
type SortMode = 'recent' | 'trending'

interface VideoFeedProps {
  followingSubRequests: TFeedSubRequest[]
  className?: string
}

export default function VideoFeed({ followingSubRequests, className }: VideoFeedProps) {
  const { t } = useTranslation()
  const { pubkey } = useNostr()
  const { hideUntrustedNotes } = useUserTrust()
  const [source, setSource] = useState<VideoSource>(pubkey ? 'following' : 'global')
  const [sortMode, setSortMode] = useState<SortMode>('recent')
  const supportTouch = useMemo(() => isTouchDevice(), [])
  const noteListRef = useRef<TNoteListRef>(null)
  const divineListRef = useRef<TDivineVideoListRef>(null)

  // Switch to global if user logs out
  useEffect(() => {
    if (!pubkey && source === 'following') {
      setSource('global')
    }
  }, [pubkey, source])

  const handleRefresh = () => {
    if (source === 'following') {
      noteListRef.current?.refresh()
    } else {
      divineListRef.current?.refresh()
    }
  }

  return (
    <div className={className}>
      {/* Source and Sort Controls */}
      <div className="flex items-center justify-between px-3 py-2 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center gap-1">
          {pubkey && (
            <Button
              variant={source === 'following' ? 'default' : 'ghost'}
              size="sm"
              className={cn('gap-1.5 h-8', source === 'following' && 'pointer-events-none')}
              onClick={() => setSource('following')}
            >
              <Users className="w-3.5 h-3.5" />
              {t('Following')}
            </Button>
          )}
          <Button
            variant={source === 'global' ? 'default' : 'ghost'}
            size="sm"
            className={cn('gap-1.5 h-8', source === 'global' && 'pointer-events-none')}
            onClick={() => setSource('global')}
          >
            <Globe className="w-3.5 h-3.5" />
            {t('Global')}
          </Button>
        </div>

        <div className="flex items-center gap-1">
          {source === 'global' && (
            <>
              <Button
                variant={sortMode === 'recent' ? 'secondary' : 'ghost'}
                size="sm"
                className="h-8"
                onClick={() => setSortMode('recent')}
              >
                {t('Recent')}
              </Button>
              <Button
                variant={sortMode === 'trending' ? 'secondary' : 'ghost'}
                size="sm"
                className="gap-1.5 h-8"
                onClick={() => setSortMode('trending')}
              >
                <Flame className="w-3.5 h-3.5" />
                {t('Trending')}
              </Button>
            </>
          )}
          {!supportTouch && <RefreshButton onClick={handleRefresh} />}
        </div>
      </div>

      {/* Video Content */}
      {source === 'following' ? (
        <NoteList
          ref={noteListRef}
          showKinds={VIDEO_KINDS}
          subRequests={followingSubRequests}
          hideReplies
          hideUntrustedNotes={hideUntrustedNotes}
        />
      ) : (
        <DivineVideoList
          ref={divineListRef}
          filterMutedNotes
          hideUntrustedNotes={hideUntrustedNotes}
        />
      )}
    </div>
  )
}
