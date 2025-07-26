import { cn } from '@/lib/utils'
import { Event } from 'nostr-tools'
import { useTranslation } from 'react-i18next'
import ClientSelect from '../ClientSelect'

export default function UnknownNote({ event, className }: { event: Event; className?: string }) {
  const { t } = useTranslation()

  return (
    <div
      className={cn(
        'flex flex-col gap-2 items-center text-muted-foreground font-medium my-4',
        className
      )}
    >
      <div>{t('Cannot handle event of kind k', { k: event.kind })}</div>
      <ClientSelect event={event} />
    </div>
  )
}
