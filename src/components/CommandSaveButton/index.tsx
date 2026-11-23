import { Button } from '@/components/ui/button'
import { useInstalledCommands } from '@/providers/InstalledCommandsProvider'
import { useNostr } from '@/providers/NostrProvider'
import { Loader, Save, SaveOff } from 'lucide-react'
import type { Event } from 'nostr-tools'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

export default function CommandSaveButton({
  coordinate,
  event
}: {
  coordinate: string
  event?: Event
}) {
  const { t } = useTranslation()
  const { checkLogin } = useNostr()
  const { coordinates, updating, addCommand, removeCommand } = useInstalledCommands()
  const [pending, setPending] = useState(false)
  const saved = coordinates.has(coordinate)
  const Icon = saved ? SaveOff : Save

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="text-muted-foreground h-auto min-h-8 max-w-[55%] shrink-0 py-1 text-start whitespace-normal"
      aria-label={saved ? t('Unsave') : undefined}
      aria-pressed={saved}
      aria-busy={pending}
      disabled={pending || updating || (!saved && !event)}
      onClick={() =>
        void checkLogin(async () => {
          setPending(true)
          try {
            if (saved) await removeCommand(coordinate)
            else if (event) await addCommand(event)
          } finally {
            setPending(false)
          }
        })
      }
    >
      {pending ? (
        <Loader className="animate-spin" aria-hidden="true" />
      ) : (
        <Icon aria-hidden="true" />
      )}
      {saved ? t('Remove') : t('Save')}
    </Button>
  )
}
