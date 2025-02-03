import { useSecondaryPage } from '@/PageManager'
import { toNote } from '@/lib/link'
import { useNostr } from '@/providers/NostrProvider'
import { Event } from 'nostr-tools'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import Content from '../Content'
import { FormattedTimestamp } from '../FormattedTimestamp'
import LikeButton from '../NoteStats/LikeButton'
import ParentNotePreview from '../ParentNotePreview'
import PostEditor from '../PostEditor'
import UserAvatar from '../UserAvatar'
import Username from '../Username'

export default function ReplyNote({
  event,
  parentEvent,
  onClickParent = () => {},
  highlight = false
}: {
  event: Event
  parentEvent?: Event
  onClickParent?: (eventId: string) => void
  highlight?: boolean
}) {
  const { t } = useTranslation()
  const { checkLogin } = useNostr()
  const { push } = useSecondaryPage()
  const [isPostDialogOpen, setIsPostDialogOpen] = useState(false)

  return (
    <div
      className={`flex space-x-2 items-start rounded-lg p-2 transition-colors duration-500 clickable ${highlight ? 'bg-highlight/50' : ''}`}
      onClick={() => push(toNote(event.id))}
    >
      <UserAvatar userId={event.pubkey} size="small" className="shrink-0" />
      <div className="w-full overflow-hidden space-y-1">
        <Username
          userId={event.pubkey}
          className="text-sm font-semibold text-muted-foreground hover:text-foreground truncate"
          skeletonClassName="h-3"
        />
        {parentEvent && (
          <ParentNotePreview
            event={parentEvent}
            onClick={(e) => {
              e.stopPropagation()
              onClickParent(parentEvent.id)
            }}
          />
        )}
        <Content event={event} size="small" />
        <div className="flex gap-2 text-xs">
          <div className="text-muted-foreground/60">
            <FormattedTimestamp timestamp={event.created_at} />
          </div>
          <div
            className="text-muted-foreground hover:text-primary cursor-pointer"
            onClick={(e) => {
              e.stopPropagation()
              checkLogin(() => setIsPostDialogOpen(true))
            }}
          >
            {t('reply')}
          </div>
        </div>
      </div>
      <LikeButton event={event} variant="reply" />
      <PostEditor parentEvent={event} open={isPostDialogOpen} setOpen={setIsPostDialogOpen} />
    </div>
  )
}
