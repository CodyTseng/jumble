import { useSecondaryPage } from '@/PageManager'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
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
import UserAvatar from '../UserAvatar'
import Username from '../Username'

export default function ReplyNote({
  event,
  parentEventId,
  onClickParent = () => {},
  highlight = false,
  className = ''
}: {
  event: Event
  parentEventId?: string
  onClickParent?: () => void
  highlight?: boolean
  className?: string
}) {
  const { t } = useTranslation()
  const { isSmallScreen } = useScreenSize()
  const { push } = useSecondaryPage()
  const { mutePubkeySet } = useMuteList()
  const { minTrustScore, meetsMinTrustScore } = useUserTrust()
  const { hideContentMentioningMutedUsers } = useContentPolicy()
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

      for (const reply of replies) {
        if (mutePubkeySet.has(reply.pubkey)) {
          continue
        }
        if (hideContentMentioningMutedUsers && isMentioningMutedUsers(reply, mutePubkeySet)) {
          continue
        }
        if (!(await meetsMinTrustScore(reply.pubkey))) {
          continue
        }
        setHasReplies(true)
        return
      }
      setHasReplies(false)
    }

    checkHasReplies()
  }, [replies, minTrustScore, meetsMinTrustScore, mutePubkeySet, hideContentMentioningMutedUsers])

  return (
    <div
      className={cn(
        'relative pb-3 transition-colors duration-500 clickable',
        highlight ? 'bg-primary/40' : '',
        className
      )}
      onClick={() => push(toNote(event))}
    >
      {hasReplies && <div className="absolute left-[34px] top-14 bottom-0 border-l z-20" />}
      <Collapsible>
        <div className="flex space-x-2 items-start px-4 pt-3">
          <UserAvatar userId={event.pubkey} size="medium" className="shrink-0 mt-0.5" />
          <div className="w-full overflow-hidden">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 w-0">
                <div className="flex gap-1 items-center">
                  <Username
                    userId={event.pubkey}
                    className="text-sm font-semibold text-muted-foreground hover:text-foreground truncate"
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
              <div className="flex items-center shrink-0">
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
                className="text-muted-foreground font-medium mt-2"
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
      {show && <StuffStats className="ml-14 pl-1 mr-4 mt-2" stuff={event} displayTopZapsAndLikes />}
    </div>
  )
}

export function ReplyNoteSkeleton() {
  return (
    <div className="px-4 py-3 flex items-start space-x-2 w-full">
      <Skeleton className="w-9 h-9 rounded-full shrink-0 mt-0.5" />
      <div className="w-full">
        <div className="py-1">
          <Skeleton className="h-3 w-16" />
        </div>
        <div className="my-1">
          <Skeleton className="w-full h-4 my-1 mt-2" />
        </div>
        <div className="my-1">
          <Skeleton className="w-2/3 h-4 my-1" />
        </div>
      </div>
    </div>
  )
}
