import { useRepostTarget } from '@/hooks'
import { cn } from '@/lib/utils'
import { Repeat } from 'lucide-react'
import { Event } from 'nostr-tools'
import { useTranslation } from 'react-i18next'
import ContentPreview from '.'

export default function RepostPreview({ event, className }: { event: Event; className?: string }) {
  const { t } = useTranslation()
  const { targetEvent, isResolving } = useRepostTarget(event)

  return (
    <div className={cn('flex items-center gap-1 truncate', className)}>
      <Repeat size={14} className="shrink-0" />
      <span className="shrink-0">[{t('Repost')}]</span>
      {targetEvent ? (
        <ContentPreview event={targetEvent} className="truncate" />
      ) : (
        <span className="truncate">{isResolving ? '…' : t('Note not found')}</span>
      )}
    </div>
  )
}
