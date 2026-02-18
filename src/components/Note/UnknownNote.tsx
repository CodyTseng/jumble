import { cn } from '@/lib/utils'
import { Event, kinds } from 'nostr-tools'
import { useTranslation } from 'react-i18next'
import ClientSelect from '../ClientSelect'

export default function UnknownNote({ event, className }: { event: Event; className?: string }) {
  const { t } = useTranslation()

  return (
    <div
      className={cn(
        'my-4 flex flex-col items-center gap-2 font-medium text-muted-foreground',
        className
      )}
    >
      <div>
        {event.kind === kinds.EncryptedDirectMessage
          ? t('Encrypted direct messages not supported')
          : t('Cannot handle event of kind k', { k: event.kind })}
      </div>
      <ClientSelect event={event} />
    </div>
  )
}
