import { ExtendedKind, NSFW_DISPLAY_POLICY, SUPPORTED_KINDS } from '@/constants'
import { getEventAuthorPubkey, isNsfwEvent } from '@/lib/event'
import { cn } from '@/lib/utils'
import { useContentPolicy } from '@/providers/ContentPolicyProvider'
import { useMuteList } from '@/providers/MuteListProvider'
import { Event, kinds } from 'nostr-tools'
import { useMemo, useState } from 'react'
import AudioPlayer from '../AudioPlayer'
import Content from '../Content'
import CommunityDefinition from './CommunityDefinition'
import EmojiPack from './EmojiPack'
import FollowPack from './FollowPack'
import GroupMetadata from './GroupMetadata'
import Highlight from './Highlight'
import LiveEvent from './LiveEvent'
import LongFormArticle from './LongFormArticle'
import LongFormArticlePreview from './LongFormArticlePreview'
import MutedNote from './MutedNote'
import NsfwNote from './NsfwNote'
import PictureNote from './PictureNote'
import Poll from './Poll'
import Reaction from './Reaction'
import RelayReview from './RelayReview'
import UnknownNote from './UnknownNote'
import VideoNote from './VideoNote'
import Zap from './Zap'

export default function NoteContent({
  className = '',
  event,
  originalNoteId,
  showFull = false
}: {
  className?: string
  event: Event
  originalNoteId?: string
  showFull?: boolean
}) {
  const { nsfwDisplayPolicy } = useContentPolicy()
  const [showNsfw, setShowNsfw] = useState(false)
  const { mutePubkeySet } = useMuteList()
  const [showMuted, setShowMuted] = useState(false)
  const isNsfw = useMemo(
    () => (nsfwDisplayPolicy === NSFW_DISPLAY_POLICY.SHOW ? false : isNsfwEvent(event)),
    [event, nsfwDisplayPolicy]
  )

  if (
    ![
      ...SUPPORTED_KINDS,
      kinds.CommunityDefinition,
      kinds.LiveEvent,
      ExtendedKind.GROUP_METADATA
    ].includes(event.kind)
  ) {
    return <UnknownNote className={cn('mt-2', className)} event={event} />
  }

  if (mutePubkeySet.has(getEventAuthorPubkey(event)) && !showMuted) {
    return <MutedNote show={() => setShowMuted(true)} />
  }

  if (isNsfw && !showNsfw) {
    return <NsfwNote show={() => setShowNsfw(true)} />
  }

  if (event.kind === kinds.Highlights) {
    return <Highlight className={cn('mt-2', className)} event={event} />
  }

  if (event.kind === kinds.LongFormArticle) {
    return showFull ? (
      <LongFormArticle className={cn('mt-2', className)} event={event} />
    ) : (
      <LongFormArticlePreview className={cn('mt-2', className)} event={event} />
    )
  }

  if (event.kind === kinds.LiveEvent) {
    return <LiveEvent className={cn('mt-2', className)} event={event} />
  }

  if (event.kind === ExtendedKind.GROUP_METADATA) {
    return (
      <GroupMetadata
        className={cn('mt-2', className)}
        event={event}
        originalNoteId={originalNoteId}
      />
    )
  }

  if (event.kind === kinds.CommunityDefinition) {
    return <CommunityDefinition className={cn('mt-2', className)} event={event} />
  }

  if (event.kind === ExtendedKind.POLL) {
    return (
      <div className={cn('mt-2', className)}>
        <Content event={event} />
        <Poll className="mt-2" event={event} />
      </div>
    )
  }

  if (event.kind === ExtendedKind.VOICE || event.kind === ExtendedKind.VOICE_COMMENT) {
    return (
      <AudioPlayer className={cn('mt-2', className)} src={event.content} pubkey={event.pubkey} />
    )
  }

  if (event.kind === ExtendedKind.PICTURE) {
    return <PictureNote className={cn('mt-2', className)} event={event} />
  }

  if (
    event.kind === ExtendedKind.VIDEO ||
    event.kind === ExtendedKind.SHORT_VIDEO ||
    event.kind === ExtendedKind.ADDRESSABLE_NORMAL_VIDEO ||
    event.kind === ExtendedKind.ADDRESSABLE_SHORT_VIDEO
  ) {
    return <VideoNote className={cn('mt-2', className)} event={event} />
  }

  if (event.kind === ExtendedKind.RELAY_REVIEW) {
    return <RelayReview className={cn('mt-2', className)} event={event} />
  }

  if (event.kind === kinds.Emojisets) {
    return <EmojiPack className={cn('mt-2', className)} event={event} />
  }

  if (event.kind === ExtendedKind.FOLLOW_PACK) {
    return <FollowPack className={cn('mt-2', className)} event={event} />
  }

  if (event.kind === kinds.Reaction) {
    return <Reaction className={cn('mt-2', className)} event={event} />
  }

  if (event.kind === kinds.Zap) {
    return <Zap className={cn('mt-2', className)} event={event} />
  }

  return <Content className={cn('mt-2', className)} event={event} enableHighlight />
}
