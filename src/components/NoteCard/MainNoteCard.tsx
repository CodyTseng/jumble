import { Separator } from '@/components/ui/separator'
import { toNote } from '@/lib/link'
import { cn } from '@/lib/utils'
import { useSecondaryPage } from '@/PageManager'
import { Event } from 'nostr-tools'
import Collapsible from '../Collapsible'
import Note from '../Note'
import StuffStats from '../StuffStats'
import PinnedButton from './PinnedButton'
import RepostDescription from './RepostDescription'

const INTERACTIVE_SELECTOR = 'button, a, input, textarea, select, [role="button"]'

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
    <div
      className={className}
      onClick={(e) => {
        // We can't stopPropagation() on inner interactive elements: React's
        // stopPropagation() also calls nativeEvent.stopPropagation(), which
        // breaks Radix Dialog's touch-mode outside-click detection (it
        // listens for native `click` bubbling to `document`). So filter
        // here instead — skip portal-rendered descendants (overlays/menus)
        // and skip interactive controls inside the card.
        const target = e.target
        if (!(target instanceof Node) || !e.currentTarget.contains(target)) return
        if (target instanceof Element && target.closest(INTERACTIVE_SELECTOR)) return
        push(toNote(originalNoteId ?? event))
      }}
    >
      <div
        className={cn(
          'clickable transition-all duration-200',
          embedded ? 'rounded-xl border bg-card p-3 sm:p-4' : 'py-3 hover:bg-accent/30'
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
    </div>
  )
}
