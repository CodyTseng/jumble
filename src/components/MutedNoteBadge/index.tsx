import { useMutedNoteNotifications } from '@/hooks/useMutedNoteNotifications'
import { getEventKey } from '@/lib/event-core'
import * as Tooltip from '@radix-ui/react-tooltip'
import { BellOff } from 'lucide-react'
import type { Event } from 'nostr-tools'
import { useTranslation } from 'react-i18next'

export default function MutedNoteBadge({ event }: { event: Event }) {
  const { t } = useTranslation()
  const { mutedNoteKeys } = useMutedNoteNotifications()
  if (!mutedNoteKeys.has(getEventKey(event))) return null

  const label = t('Note notifications muted')
  return (
    <Tooltip.Provider delayDuration={150}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <span
            role="img"
            aria-label={label}
            tabIndex={0}
            className="focus-visible:ring-ring flex shrink-0 items-center rounded-full bg-red-500/10 px-2 py-0.5 text-red-600 focus-visible:ring-2 focus-visible:outline-none dark:text-red-400"
          >
            <BellOff aria-hidden="true" className="size-3" />
          </span>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            side="top"
            sideOffset={4}
            collisionPadding={8}
            hideWhenDetached
            className="bg-popover text-popover-foreground z-50 max-w-48 rounded-md border px-2 py-1 text-xs font-medium shadow-sm"
          >
            {label}
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  )
}
