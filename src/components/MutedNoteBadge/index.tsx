import { useMutedNoteNotifications } from '@/hooks/useMutedNoteNotifications'
import { getEventKey } from '@/lib/event-core'
import { BellOff } from 'lucide-react'
import type { Event } from 'nostr-tools'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

export default function MutedNoteBadge({ event }: { event: Event }) {
  const { t } = useTranslation()
  const { mutedNoteKeys } = useMutedNoteNotifications()
  const [dismissed, setDismissed] = useState(false)
  if (!mutedNoteKeys.has(getEventKey(event))) return null

  const label = t('Note notifications muted')
  return (
    <span
      role="img"
      aria-label={label}
      tabIndex={0}
      className="group/muted-note focus-visible:ring-ring relative flex shrink-0 items-center rounded-full bg-red-500/10 px-2 py-0.5 text-red-600 focus-visible:ring-2 focus-visible:outline-none dark:text-red-400"
      onPointerLeave={() => setDismissed(false)}
      onBlur={() => setDismissed(false)}
      onKeyDown={(e) => {
        if (e.key !== 'Escape') return
        e.stopPropagation()
        setDismissed(true)
      }}
    >
      <BellOff aria-hidden="true" className="size-3" />
      {!dismissed && (
        <span
          aria-hidden="true"
          className="invisible absolute start-0 bottom-full z-20 w-max max-w-48 pb-1 group-hover/muted-note:visible group-focus-visible/muted-note:visible"
        >
          <span className="bg-popover text-popover-foreground block rounded-md border px-2 py-1 text-xs font-medium shadow-sm">
            {label}
          </span>
        </span>
      )}
    </span>
  )
}
