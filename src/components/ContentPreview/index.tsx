import { ExtendedKind } from '@/constants'
import { isMentioningMutedUsers } from '@/lib/event'
import { cn } from '@/lib/utils'
import { useContentPolicy } from '@/providers/ContentPolicyProvider'
import { useMuteList } from '@/providers/MuteListProvider'
import { Event, kinds } from 'nostr-tools'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import CommunityDefinitionPreview from './CommunityDefinitionPreview'
import GroupMetadataPreview from './GroupMetadataPreview'
import HighlightPreview from './HighlightPreview'
import LiveEventPreview from './LiveEventPreview'
import LongFormArticlePreview from './LongFormArticlePreview'
import NormalContentPreview from './NormalContentPreview'
import PictureNotePreview from './PictureNotePreview'
import PollPreview from './PollPreview'
import VideoNotePreview from './VideoNotePreview'

export default function ContentPreview({
  event,
  className
}: {
  event?: Event
  className?: string
}) {
  const { t } = useTranslation()
  const { mutePubkeySet } = useMuteList()
  const { hideContentMentioningMutedUsers } = useContentPolicy()
  const isMuted = useMemo(
    () => (event ? mutePubkeySet.has(event.pubkey) : false),
    [mutePubkeySet, event]
  )
  const isMentioningMuted = useMemo(
    () =>
      hideContentMentioningMutedUsers && event
        ? isMentioningMutedUsers(event, mutePubkeySet)
        : false,
    [event, mutePubkeySet]
  )

  if (!event) {
    return <div className={cn('pointer-events-none', className)}>{`[${t('Note not found')}]`}</div>
  }

  if (isMuted) {
    return (
      <div className={cn('pointer-events-none', className)}>[{t('This user has been muted')}]</div>
    )
  }

  if (isMentioningMuted) {
    return (
      <div className={cn('pointer-events-none', className)}>
        [{t('This note mentions a user you muted')}]
      </div>
    )
  }

  if (
    [
      kinds.ShortTextNote,
      ExtendedKind.COMMENT,
      ExtendedKind.VOICE,
      ExtendedKind.VOICE_COMMENT,
      ExtendedKind.RELAY_REVIEW
    ].includes(event.kind)
  ) {
    return <NormalContentPreview event={event} className={className} />
  }

  if (event.kind === kinds.Highlights) {
    return <HighlightPreview event={event} className={className} />
  }

  if (event.kind === ExtendedKind.POLL) {
    return <PollPreview event={event} className={className} />
  }

  if (event.kind === kinds.LongFormArticle) {
    return <LongFormArticlePreview event={event} className={className} />
  }

  if (event.kind === ExtendedKind.VIDEO || event.kind === ExtendedKind.SHORT_VIDEO) {
    return <VideoNotePreview event={event} className={className} />
  }

  if (event.kind === ExtendedKind.PICTURE) {
    return <PictureNotePreview event={event} className={className} />
  }

  if (event.kind === ExtendedKind.GROUP_METADATA) {
    return <GroupMetadataPreview event={event} className={className} />
  }

  if (event.kind === kinds.CommunityDefinition) {
    return <CommunityDefinitionPreview event={event} className={className} />
  }

  if (event.kind === kinds.LiveEvent) {
    return <LiveEventPreview event={event} className={className} />
  }

  return <div className={className}>[{t('Cannot handle event of kind k', { k: event.kind })}]</div>
}
