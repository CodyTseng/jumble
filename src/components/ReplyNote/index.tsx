import { useSecondaryPage } from '@/PageManager'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { toNote } from '@/lib/link'
import { useMuteList } from '@/providers/MuteListProvider'
import { Event } from 'nostr-tools'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Collapsible from '../Collapsible'
import Content from '../Content'
import { FormattedTimestamp } from '../FormattedTimestamp'
import NoteOptions from '../NoteOptions'
import NoteStats from '../NoteStats'
import ParentNotePreview from '../ParentNotePreview'
import UserAvatar from '../UserAvatar'
import Username from '../Username'
import TranslateButton from '../TranslateButton'

export default function ReplyNote({
  event,
  parentEventId,
  onClickParent = () => {},
  highlight = false
}: {
  event: Event
  parentEventId?: string
  onClickParent?: () => void
  highlight?: boolean
}) {
  const { t } = useTranslation()
  const { push } = useSecondaryPage()
  const { mutePubkeys } = useMuteList()
  const [showMuted, setShowMuted] = useState(false)
  const show = useMemo(
    () => showMuted || !mutePubkeys.includes(event.pubkey),
    [showMuted, mutePubkeys, event]
  )

  return (
    <div
      className={`pb-3 border-b transition-colors duration-500 clickable ${highlight ? 'bg-primary/50' : ''}`}
      onClick={() => push(toNote(event))}
    >
      <Collapsible>
        <div className="flex space-x-2 items-start px-4 pt-3">
          <UserAvatar userId={event.pubkey} className="shrink-0 h-8 w-8" />
          <div className="w-full overflow-hidden">
            <div className="flex items-start justify-between gap-2">
              <div className="flex gap-2 items-center flex-1">
                <Username
                  userId={event.pubkey}
                  className="text-sm font-semibold text-muted-foreground hover:text-foreground truncate"
                  skeletonClassName="h-3"
                />
                <div className="text-xs text-muted-foreground shrink-0">
                  <FormattedTimestamp timestamp={event.created_at} />
                </div>
              </div>
              <div className="flex items-center">
                <TranslateButton event={event} />
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
                onClick={() => setShowMuted(true)}
              >
                {t('Temporarily display this reply')}
              </Button>
            )}
          </div>
        </div>
      </Collapsible>
      {show && <NoteStats className="ml-14 mr-4 mt-2" event={event} displayTopZapsAndLikes />}
    </div>
  )
}

export function ReplyNoteSkeleton() {
  return (
    <div className="px-4 py-3 flex items-start space-x-2 w-full">
      <Skeleton className="w-8 h-8 rounded-full shrink-0" />
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
