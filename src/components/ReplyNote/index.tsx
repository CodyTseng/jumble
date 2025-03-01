import { Button } from '@/components/ui/button'
import { useMuteList } from '@/providers/MuteListProvider'
import { Event } from 'nostr-tools'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Content from '../Content'
import { FormattedTimestamp } from '../FormattedTimestamp'
import NoteStats from '../NoteStats'
import ParentNotePreview from '../ParentNotePreview'
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
  const { mutePubkeys } = useMuteList()
  const [showMuted, setShowMuted] = useState(false)
  const show = useMemo(
    () => showMuted || !mutePubkeys.includes(event.pubkey),
    [showMuted, mutePubkeys, event]
  )

  return (
    <div
      className={`flex space-x-2 items-start rounded-lg p-2 transition-colors duration-500 ${highlight ? 'bg-highlight/50' : ''}`}
    >
      <UserAvatar userId={event.pubkey} size="small" className="shrink-0" />
      <div className="w-full overflow-hidden">
        <div className="flex gap-2 items-center">
          <Username
            userId={event.pubkey}
            className="text-sm font-semibold text-muted-foreground hover:text-foreground truncate"
            skeletonClassName="h-3"
          />
          <div className="text-xs text-muted-foreground shrink-0">
            <FormattedTimestamp timestamp={event.created_at} />
          </div>
        </div>
        {parentEvent && (
          <ParentNotePreview
            className="mt-1"
            event={parentEvent}
            onClick={(e) => {
              e.stopPropagation()
              onClickParent(parentEvent.id)
            }}
          />
        )}
        {show ? (
          <>
            <Content className="mt-1" event={event} size="small" />
            <NoteStats className="mt-2" event={event} variant="reply" />
          </>
        ) : (
          <Button
            variant="outline"
            className="text-muted-foreground font-medium mt-2"
            onClick={() => setShowMuted(true)}
          >
            {t('Temporarily display this reply')}
          </Button>
        )}
      </div>
    </div>
  )
}
