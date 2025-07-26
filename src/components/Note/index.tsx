import { useSecondaryPage } from '@/PageManager'
import { ExtendedKind } from '@/constants'
import {
  getImageInfosFromEvent,
  getParentBech32Id,
  getUsingClient,
  isNsfwEvent,
  isPictureEvent
} from '@/lib/event'
import { toNote } from '@/lib/link'
import { useMuteList } from '@/providers/MuteListProvider'
import { useScreenSize } from '@/providers/ScreenSizeProvider'
import { Event, kinds } from 'nostr-tools'
import { useMemo, useState } from 'react'
import Content from '../Content'
import { FormattedTimestamp } from '../FormattedTimestamp'
import ImageGallery from '../ImageGallery'
import Nip05 from '../Nip05'
import NoteOptions from '../NoteOptions'
import ParentNotePreview from '../ParentNotePreview'
import TranslateButton from '../TranslateButton'
import UserAvatar from '../UserAvatar'
import Username from '../Username'
import CommunityDefinition from './CommunityDefinition'
import GroupMetadata from './GroupMetadata'
import Highlight from './Highlight'
import IValue from './IValue'
import LiveEvent from './LiveEvent'
import LongFormArticle from './LongFormArticle'
import MutedNote from './MutedNote'
import NsfwNote from './NsfwNote'
import Poll from './Poll'
import UnknownNote from './UnknownNote'

export default function Note({
  event,
  originalNoteId,
  size = 'normal',
  className,
  hideParentNotePreview = false
}: {
  event: Event
  originalNoteId?: string
  size?: 'normal' | 'small'
  className?: string
  hideParentNotePreview?: boolean
}) {
  const { push } = useSecondaryPage()
  const { isSmallScreen } = useScreenSize()
  const parentEventId = useMemo(
    () => (hideParentNotePreview ? undefined : getParentBech32Id(event)),
    [event, hideParentNotePreview]
  )
  const imageInfos = useMemo(
    () => (isPictureEvent(event) ? getImageInfosFromEvent(event) : []),
    [event]
  )
  const usingClient = useMemo(() => getUsingClient(event), [event])
  const [showNsfw, setShowNsfw] = useState(false)
  const { mutePubkeys } = useMuteList()
  const [showMuted, setShowMuted] = useState(false)

  let content: React.ReactNode
  if (
    ![
      kinds.ShortTextNote,
      kinds.Highlights,
      kinds.LongFormArticle,
      kinds.LiveEvent,
      kinds.CommunityDefinition,
      ExtendedKind.GROUP_METADATA,
      ExtendedKind.PICTURE,
      ExtendedKind.COMMENT,
      ExtendedKind.POLL
    ].includes(event.kind)
  ) {
    content = <UnknownNote className="mt-2" event={event} />
  } else if (mutePubkeys.includes(event.pubkey) && !showMuted) {
    content = <MutedNote show={() => setShowMuted(true)} />
  } else if (isNsfwEvent(event) && !showNsfw) {
    content = <NsfwNote show={() => setShowNsfw(true)} />
  } else if (event.kind === kinds.Highlights) {
    content = <Highlight className="mt-2" event={event} />
  } else if (event.kind === kinds.LongFormArticle) {
    content = <LongFormArticle className="mt-2" event={event} />
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
  } else {
    content = <Content className="mt-2" event={event} />
  }

  return (
    <div className={className}>
      <div className="flex justify-between items-start gap-2">
        <div className="flex items-center space-x-2 flex-1">
          <UserAvatar userId={event.pubkey} size={size === 'small' ? 'medium' : 'normal'} />
          <div className="flex-1 w-0">
            <div className="flex gap-2 items-baseline">
              <Username
                userId={event.pubkey}
                className={`font-semibold flex truncate ${size === 'small' ? 'text-sm' : ''}`}
                skeletonClassName={size === 'small' ? 'h-3' : 'h-4'}
              />
              {usingClient && size === 'normal' && (
                <span className="text-sm text-muted-foreground shrink-0">using {usingClient}</span>
              )}
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
      {parentEventId && (
        <ParentNotePreview
          eventId={parentEventId}
          className="mt-2"
          onClick={(e) => {
            e.stopPropagation()
            push(toNote(parentEventId))
          }}
        />
      )}
      <IValue event={event} className="mt-2" />
      {content}
      {imageInfos.length > 0 && <ImageGallery images={imageInfos} />}
    </div>
  )
}
