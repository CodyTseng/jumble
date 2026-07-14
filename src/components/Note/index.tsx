import { useSecondaryPage } from '@/PageManager'
import { ExtendedKind } from '@/constants'
import { getEventAuthorPubkey, getParentStuff } from '@/lib/event'
import { toExternalContent, toNote } from '@/lib/link'
import { generateBech32IdFromATag, generateBech32IdFromETag, tagNameEquals } from '@/lib/tag'
import { useScreenSize } from '@/providers/ScreenSizeProvider'
import { Event, kinds } from 'nostr-tools'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import ClientTag from '../ClientTag'
import FollowingBadge from '../FollowingBadge'
import { FormattedTimestamp } from '../FormattedTimestamp'
import Nip05 from '../Nip05'
import NoteContent from '../NoteContent'
import NoteOptions from '../NoteOptions'
import OpBadge from '../OpBadge'
import ParentNotePreview from '../ParentNotePreview'
import ProtectedBadge from '../ProtectedBadge'
import TranslateButton from '../TranslateButton'
import TrustScoreBadge from '../TrustScoreBadge'
import UserAvatar from '../UserAvatar'
import Username from '../Username'

export default function Note({
  event,
  originalNoteId,
  size = 'normal',
  className,
  hideParentNotePreview = false,
  showFull = false,
  hideHeader = false,
  opPubkey
}: {
  event: Event
  originalNoteId?: string
  size?: 'normal' | 'small'
  className?: string
  hideParentNotePreview?: boolean
  showFull?: boolean
  hideHeader?: boolean
  opPubkey?: string
}) {
  const { t } = useTranslation()
  const { push } = useSecondaryPage()
  const { isSmallScreen } = useScreenSize()
  const { parentEventId, parentExternalContent } = useMemo(() => {
    return getParentStuff(event)
  }, [event])
  const displayPubkey = useMemo(() => getEventAuthorPubkey(event), [event])
  const reactionTargetEventId = useMemo(() => {
    if (event.kind !== kinds.Reaction && event.kind !== ExtendedKind.EXTERNAL_CONTENT_REACTION) {
      return undefined
    }
    const aTag = event.tags.findLast(tagNameEquals('a'))
    if (aTag) return generateBech32IdFromATag(aTag)
    const eTag = event.tags.findLast(tagNameEquals('e'))
    return eTag ? generateBech32IdFromETag(eTag) : undefined
  }, [event])
  const displayTimestamp = useMemo(() => {
    if (event.kind === kinds.LongFormArticle) {
      const publishedAt = event.tags.find(tagNameEquals('published_at'))?.[1]
      const parsed = publishedAt ? parseInt(publishedAt, 10) : NaN
      if (Number.isFinite(parsed)) return parsed
    }
    return event.created_at
  }, [event])

  return (
    <div className={className}>
      {!hideHeader && (
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <UserAvatar userId={displayPubkey} size={size === 'small' ? 'medium' : 'normal'} />
            <div className="w-0 flex-1">
              <div className="flex min-w-0 items-center gap-2">
                <Username
                  userId={displayPubkey}
                  className={`flex truncate font-semibold ${size === 'small' ? 'text-sm' : ''}`}
                  skeletonClassName={size === 'small' ? 'h-3' : 'h-4'}
                />
                <FollowingBadge pubkey={displayPubkey} />
                {opPubkey === displayPubkey && <OpBadge />}
                <TrustScoreBadge pubkey={displayPubkey} />
                <ProtectedBadge event={event} />
                <ClientTag event={event} />
              </div>
              <div className="text-muted-foreground flex items-center gap-1 text-sm">
                <Nip05 pubkey={displayPubkey} append="·" />
                <FormattedTimestamp
                  timestamp={displayTimestamp}
                  className="shrink-0"
                  short={isSmallScreen}
                />
              </div>
            </div>
          </div>
          <div className="flex shrink-0 items-center">
            <TranslateButton
              event={event}
              showFull={showFull}
              className={size === 'normal' ? '' : 'pe-0'}
            />
            {size === 'normal' && (
              <NoteOptions event={event} className="shrink-0 py-1 [&_svg]:size-5" />
            )}
          </div>
        </div>
      )}
      {!hideParentNotePreview && (
        <ParentNotePreview
          eventId={parentEventId}
          externalContent={parentExternalContent}
          className="mt-2"
          onClick={(e) => {
            e.stopPropagation()
            if (parentExternalContent) {
              push(toExternalContent(parentExternalContent))
            } else if (parentEventId) {
              push(toNote(parentEventId))
            }
          }}
        />
      )}
      {reactionTargetEventId && (
        <ParentNotePreview
          eventId={reactionTargetEventId}
          label={t('reacted to')}
          className="mt-2"
          onClick={(e) => {
            e.stopPropagation()
            push(toNote(reactionTargetEventId))
          }}
        />
      )}
      <NoteContent event={event} originalNoteId={originalNoteId} showFull={showFull} />
    </div>
  )
}
