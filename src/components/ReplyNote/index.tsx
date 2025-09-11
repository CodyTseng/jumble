import { useSecondaryPage } from '@/PageManager'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { isMentioningMutedUsers } from '@/lib/event'
import { toNote } from '@/lib/link'
import { useContentPolicy } from '@/providers/ContentPolicyProvider'
import { useMuteList } from '@/providers/MuteListProvider'
import { useScreenSize } from '@/providers/ScreenSizeProvider'
import { Event } from 'nostr-tools'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import ClientTag from '../ClientTag'
import Collapsible from '../Collapsible'
import Content from '../Content'
import { FormattedTimestamp } from '../FormattedTimestamp'
import Nip05 from '../Nip05'
import NoteOptions from '../NoteOptions'
import NoteStats from '../NoteStats'
import ParentNotePreview from '../ParentNotePreview'
import TranslateButton from '../TranslateButton'
import UserAvatar from '../UserAvatar'
import Username from '../Username'

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
  const { isSmallScreen } = useScreenSize()
  const { push } = useSecondaryPage()
  const { mutePubkeySet } = useMuteList()
  const { hideContentMentioningMutedUsers } = useContentPolicy()
  const [showMuted, setShowMuted] = useState(false)
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

  return (
    <div
      className={`pb-3 border-b transition-colors duration-500 clickable ${highlight ? 'bg-primary/50' : ''}`}
      onClick={() => push(toNote(event))}
    >
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
      {show && <NoteStats className="ml-14 pl-1 mr-4 mt-2" event={event} displayTopZapsAndLikes />}
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
