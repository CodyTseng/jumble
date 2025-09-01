import { ExtendedKind } from '@/constants'
import { cn } from '@/lib/utils'
import { useMuteList } from '@/providers/MuteListProvider'
import { useContentPolicy } from '@/providers/ContentPolicyProvider'
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
  const { mutePubkeys } = useMuteList()
  const { defaultShowMuted } = useContentPolicy()
  const isMuted = useMemo(
    () => (event ? mutePubkeys.includes(event.pubkey) : false),
    [mutePubkeys, event]
  )

  if (!event) {
    return <div className={cn('pointer-events-none', className)}>{`[${t('Note not found')}]`}</div>
  }

  if (isMuted && !defaultShowMuted) {
    return (
      <div></div>
      // <div className={cn('pointer-events-none', className)}>[{t('This user has been muted')}]</div>
    )
  }

  if (
    [
      kinds.ShortTextNote,
      ExtendedKind.COMMENT,
      ExtendedKind.VOICE,
      ExtendedKind.VOICE_COMMENT
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
