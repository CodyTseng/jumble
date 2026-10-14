import { Separator } from '@/components/ui/separator'
import { toNote } from '@/lib/link'
import { cn } from '@/lib/utils'
import { useSecondaryPage } from '@/PageManager'
import { Event } from 'nostr-tools'
import ClickableCard from '../ClickableCard'
import Collapsible from '../Collapsible'
import Note from '../Note'
import StuffStats from '../StuffStats'
import PinnedButton from './PinnedButton'
import RepostDescription from './RepostDescription'

export default function MainNoteCard({
  event,
  className,
  reposters,
  embedded,
  originalNoteId,
  pinned = false
}: {
  event: Event
  className?: string
  reposters?: string[]
  embedded?: boolean
  originalNoteId?: string
  pinned?: boolean
}) {
  const { push } = useSecondaryPage()

  return (
    <ClickableCard className={className} onClick={() => push(toNote(originalNoteId ?? event))}>
      <div
        className={cn(
          'clickable transition-all duration-200 [--image-strip-bleed-start:var(--image-strip-bleed)]',
          embedded
            ? 'bg-card rounded-xl border p-3 [--image-strip-bleed:0.75rem] sm:p-4 sm:[--image-strip-bleed:1rem]'
            : 'hover:bg-accent/30 py-3 [--image-strip-bleed:1rem]'
        )}
      >
        <Collapsible alwaysExpand={embedded}>
          {pinned && <PinnedButton event={event} />}
          <RepostDescription className={embedded ? '' : 'px-4'} reposters={reposters} />
          <Note
            className={embedded ? '' : 'px-4'}
            size={embedded ? 'small' : 'normal'}
            event={event}
            originalNoteId={originalNoteId}
          />
        </Collapsible>
        {!embedded && <StuffStats className="mt-3 px-4" stuff={event} />}
      </div>
      {!embedded && <Separator />}
    </ClickableCard>
  )
}
