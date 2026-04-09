import { useSecondaryPage } from '@/PageManager'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { SPECIAL_TRUST_SCORE_FILTER_ID } from '@/constants'
import { useThread } from '@/hooks/useThread'
import { getEventKey, isMentioningMutedUsers } from '@/lib/event'
import { toNote } from '@/lib/link'
import { cn } from '@/lib/utils'
import { useContentPolicy } from '@/providers/ContentPolicyProvider'
import { useMuteList } from '@/providers/MuteListProvider'
import { useScreenSize } from '@/providers/ScreenSizeProvider'
import { useUserTrust } from '@/providers/UserTrustProvider'
import { Event } from 'nostr-tools'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import ClientTag from '../ClientTag'
import Collapsible from '../Collapsible'
import Content from '../Content'
import { FormattedTimestamp } from '../FormattedTimestamp'
import Nip05 from '../Nip05'
import NoteOptions from '../NoteOptions'
import ParentNotePreview from '../ParentNotePreview'
import StuffStats from '../StuffStats'
import TranslateButton from '../TranslateButton'
import TrustScoreBadge from '../TrustScoreBadge'
import UserAvatar, { UserAvatarSkeleton } from '../UserAvatar'
import Username from '../Username'

export default function ReplyNote({
  event,
  parentEventId,
  onClickParent = () => {},
  highlight = false,
  hideThreadGuide = false,
  className = ''
}: {
  event: Event
  parentEventId?: string
  onClickParent?: () => void
  highlight?: boolean
  hideThreadGuide?: boolean
  className?: string
}) {
  const { t } = useTranslation()
  const { isSmallScreen } = useScreenSize()
  const { push } = useSecondaryPage()
  const { mutePubkeySet } = useMuteList()
  const { getMinTrustScore, meetsMinTrustScore } = useUserTrust()
  const { hideContentMentioningMutedUsers, autoLoadProfilePicture } = useContentPolicy()
  const eventKey = useMemo(() => getEventKey(event), [event])
  const replies = useThread(eventKey)
  const [showMuted, setShowMuted] = useState(false)
  const [hasReplies, setHasReplies] = useState(false)

  const show = useMemo(() => {
    if (showMuted) {
      return true
    }
    if (mutePubkeySet.has(event.pubkey)) {
      return false
    }
    if (hideContentMentioningMutedUsers && isMentioningMutedUsers(event, mutePubkeySet)) {
      return false
    }
    return true
  }, [showMuted, mutePubkeySet, event, hideContentMentioningMutedUsers])

  useEffect(() => {
    const checkHasReplies = async () => {
      if (!replies || replies.length === 0) {
        setHasReplies(false)
        return
      }

      const trustScoreThreshold = getMinTrustScore(SPECIAL_TRUST_SCORE_FILTER_ID.INTERACTIONS)
      for (const reply of replies) {
        if (mutePubkeySet.has(reply.pubkey)) {
          continue
        }
        if (hideContentMentioningMutedUsers && isMentioningMutedUsers(reply, mutePubkeySet)) {
          continue
        }
        if (trustScoreThreshold && !(await meetsMinTrustScore(reply.pubkey, trustScoreThreshold))) {
          continue
        }
        setHasReplies(true)
        return
      }
      setHasReplies(false)
    }

    checkHasReplies()
  }, [
    replies,
    getMinTrustScore,
    meetsMinTrustScore,
    mutePubkeySet,
    hideContentMentioningMutedUsers
  ])

  return (
    <div
      className={cn(
        'clickable relative pb-3 transition-colors duration-500',
        highlight ? 'bg-primary/40' : '',
        className
      )}
      onClick={() => push(toNote(event))}
    >
      {hasReplies &&
        !hideThreadGuide &&
        (autoLoadProfilePicture ? (
          <div className="absolute bottom-0 left-[34px] top-14 z-20 border-l" />
        ) : (
          <div className="absolute bottom-0 left-2 top-5 z-20 w-3 rounded-tl-lg border-l border-t" />
        ))}
      <Collapsible>
        <div
          className={cn(
            'flex items-start space-x-2 pr-4 pt-3',
            autoLoadProfilePicture || hideThreadGuide ? 'pl-4' : 'pl-7'
          )}
        >
          <UserAvatar userId={event.pubkey} size="medium" className="mt-0.5 shrink-0" />
          <div className="w-full overflow-hidden">
            <div className="flex items-start justify-between gap-2">
              <div className="w-0 flex-1">
                <div className="flex items-center gap-1">
                  <Username
                    userId={event.pubkey}
                    className="truncate text-sm font-semibold text-muted-foreground hover:text-foreground"
                    skeletonClassName="h-3"
                  />
                  <TrustScoreBadge pubkey={event.pubkey} className="!size-3.5" />
                  <ClientTag event={event} />
                </div>
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Nip05 pubkey={event.pubkey} append="·" />
                  <FormattedTimestamp
                    timestamp={event.created_at}
                    className="shrink-0"
                    short={isSmallScreen}
                  />
                </div>
              </div>
              <div className="flex shrink-0 items-center">
                <TranslateButton event={event} className="py-0" />
                <NoteOptions event={event} className="shrink-0 [&_svg]:size-5" />
              </div>
            </div>
            {parentEventId && (
              <ParentNotePreview
                className="mt-2"
                eventId={parentEventId}
                onClick={(e) => {
                  e.stopPropagation()
                  onClickParent()
                }}
              />
            )}
            {show ? (
              <Content className="mt-2" event={event} />
            ) : (
              <Button
                variant="outline"
                className="mt-2 font-medium text-muted-foreground"
                onClick={(e) => {
                  e.stopPropagation()
                  setShowMuted(true)
                }}
              >
                {t('Temporarily display this reply')}
              </Button>
            )}
          </div>
        </div>
      </Collapsible>
      {show && (
        <StuffStats
          className={cn(
            'mr-4 mt-2 pl-1',
            autoLoadProfilePicture ? 'ml-14' : hideThreadGuide ? 'ml-4' : 'ml-7'
          )}
          stuff={event}
          displayTopZapsAndLikes
        />
      )}
    </div>
  )
}

export function ReplyNoteSkeleton() {
  return (
    <div className="flex w-full items-start space-x-2 px-4 py-3">
      <UserAvatarSkeleton className="mt-0.5 h-9 w-9" />
      <div className="w-full">
        <div className="py-1">
          <Skeleton className="h-3 w-16" />
        </div>
        <div className="my-1">
          <Skeleton className="my-1 mt-2 h-4 w-full" />
        </div>
        <div className="my-1">
          <Skeleton className="my-1 h-4 w-2/3" />
        </div>
      </div>
    </div>
  )
}
