import { getNip51FollowSetInfoFromEvent } from '@/lib/event-metadata'
import { cn } from '@/lib/utils'
import { Event } from 'nostr-tools'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

export default function Nip51ListPreview({ event, className }: { event: Event; className?: string }) {
  const { t } = useTranslation()
  const { title, description, pubkeys } = useMemo(() => getNip51FollowSetInfoFromEvent(event), [event])

  return (
    <div className={cn('rounded-lg border bg-muted/30 p-3', className)}>
      <div className="flex items-center gap-2">
        <div className="truncate text-base font-semibold">{title}</div>
        <div className="shrink-0 text-xs text-muted-foreground">{t('n users', { count: pubkeys.length })}</div>
      </div>
      {description ? (
        <div className="mt-1 line-clamp-3 whitespace-pre-wrap text-sm text-muted-foreground">
          {description}
        </div>
      ) : null}
    </div>
  )
}

