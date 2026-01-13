import { useSecondaryPage } from '@/PageManager'
import { ExtendedKind, NSFW_DISPLAY_POLICY, SUPPORTED_KINDS } from '@/constants'
import { getParentStuff, isNsfwEvent } from '@/lib/event'
import { toExternalContent, toNote } from '@/lib/link'
import { useContentPolicy } from '@/providers/ContentPolicyProvider'
import { useMuteList } from '@/providers/MuteListProvider'
import { useScreenSize } from '@/providers/ScreenSizeProvider'
import { Event, kinds } from 'nostr-tools'
import { useMemo, useState } from 'react'
import AudioPlayer from '../AudioPlayer'
import ClientTag from '../ClientTag'
import Content from '../Content'
import FollowingBadge from '../FollowingBadge'
import { FormattedTimestamp } from '../FormattedTimestamp'
import Nip05 from '../Nip05'
import NoteOptions from '../NoteOptions'
import ParentNotePreview from '../ParentNotePreview'
import TranslateButton from '../TranslateButton'
import TrustScoreBadge from '../TrustScoreBadge'
import UserAvatar from '../UserAvatar'
import Username from '../Username'
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
import RelayReview from './RelayReview'
import UnknownNote from './UnknownNote'
import VideoNote from './VideoNote'

export default function Note({
  event,
  originalNoteId,
  size = 'normal',
  className,
  hideParentNotePreview = false,
  showFull = false
}: {
  event: Event
  originalNoteId?: string
  size?: 'normal' | 'small'
  className?: string
  hideParentNotePreview?: boolean
  showFull?: boolean
}) {
  const { push } = useSecondaryPage()
  const { isSmallScreen } = useScreenSize()
  const { parentEventId, parentExternalContent } = useMemo(() => {
    return getParentStuff(event)
  }, [event])
  const { nsfwDisplayPolicy } = useContentPolicy()
  const [showNsfw, setShowNsfw] = useState(false)
  const { mutePubkeySet } = useMuteList()
  const [showMuted, setShowMuted] = useState(false)
  const isNsfw = useMemo(
    () => (nsfwDisplayPolicy === NSFW_DISPLAY_POLICY.SHOW ? false : isNsfwEvent(event)),
    [event, nsfwDisplayPolicy]
  )

  let content: React.ReactNode
  if (
    ![
      ...SUPPORTED_KINDS,
      kinds.CommunityDefinition,
      kinds.LiveEvent,
      ExtendedKind.GROUP_METADATA
    ].includes(event.kind)
  ) {
    content = <UnknownNote className="mt-2" event={event} />
  } else if (mutePubkeySet.has(event.pubkey) && !showMuted) {
    content = <MutedNote show={() => setShowMuted(true)} />
  } else if (isNsfw && !showNsfw) {
    content = <NsfwNote show={() => setShowNsfw(true)} />
  } else if (event.kind === kinds.Highlights) {
    content = <Highlight className="mt-2" event={event} />
  } else if (event.kind === kinds.LongFormArticle) {
    content = showFull ? (
      <LongFormArticle className="mt-2" event={event} />
    ) : (
      <LongFormArticlePreview className="mt-2" event={event} />
    )
  } else if (event.kind === kinds.LiveEvent) {
    content = <LiveEvent className="mt-2" event={event} />
  } else if (event.kind === ExtendedKind.GROUP_METADATA) {
    content = <GroupMetadata className="mt-2" event={event} originalNoteId={originalNoteId} />
  } else if (event.kind === kinds.CommunityDefinition) {
    content = <CommunityDefinition className="mt-2" event={event} />
  } else if (event.kind === ExtendedKind.POLL) {
    content = (
      <>
        <Content className="mt-2" event={event} />
        <Poll className="mt-2" event={event} />
      </>
    )
  } else if (event.kind === ExtendedKind.VOICE || event.kind === ExtendedKind.VOICE_COMMENT) {
    content = <AudioPlayer className="mt-2" src={event.content} />
  } else if (event.kind === ExtendedKind.PICTURE) {
    content = <PictureNote className="mt-2" event={event} />
  } else if (
    event.kind === ExtendedKind.VIDEO ||
    event.kind === ExtendedKind.SHORT_VIDEO ||
    event.kind === ExtendedKind.ADDRESSABLE_NORMAL_VIDEO ||
    event.kind === ExtendedKind.ADDRESSABLE_SHORT_VIDEO
  ) {
    content = <VideoNote className="mt-2" event={event} />
  } else if (event.kind === ExtendedKind.RELAY_REVIEW) {
    content = <RelayReview className="mt-2" event={event} />
  } else if (event.kind === kinds.Emojisets) {
    content = <EmojiPack className="mt-2" event={event} />
  } else if (event.kind === ExtendedKind.FOLLOW_PACK) {
    content = <FollowPack className="mt-2" event={event} />
  } else {
    content = <Content className="mt-2" event={event} enableHighlight />
  }

  return (
    <div className={className}>
      <div className="flex justify-between items-start gap-2">
        <div className="flex items-center space-x-2 flex-1">
          <UserAvatar userId={event.pubkey} size={size === 'small' ? 'medium' : 'normal'} />
          <div className="flex-1 w-0">
            <div className="flex gap-2 items-center">
              <Username
                userId={event.pubkey}
                className={`font-semibold flex truncate ${size === 'small' ? 'text-sm' : ''}`}
                skeletonClassName={size === 'small' ? 'h-3' : 'h-4'}
              />
              <FollowingBadge pubkey={event.pubkey} />
              <TrustScoreBadge pubkey={event.pubkey} />
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
        </div>
        <div className="flex items-center">
          <TranslateButton event={event} className={size === 'normal' ? '' : 'pr-0'} />
          {size === 'normal' && (
            <NoteOptions event={event} className="py-1 shrink-0 [&_svg]:size-5" />
          )}
        </div>
      </div>
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
      {content}
    </div>
  )
}
