import { getZapInfoFromEvent } from '@/lib/event-metadata'
import { formatAmount } from '@/lib/lightning'
import { cn } from '@/lib/utils'
import { Zap } from 'lucide-react'
import { Event } from 'nostr-tools'
import { useTranslation } from 'react-i18next'

export default function ZapPreview({ event, className }: { event: Event; className?: string }) {
  const { t } = useTranslation()
  const info = getZapInfoFromEvent(event)

  return (
    <div className={cn('flex items-center gap-1 truncate', className)}>
      <Zap size={14} className="shrink-0 fill-yellow-400 text-yellow-400" />
      <span className="shrink-0 text-yellow-500">
        {info?.amount ? `${formatAmount(info.amount)} ${t('sats')}` : t('Zap')}
      </span>
      {info?.comment && <span className="truncate">{info.comment}</span>}
    </div>
  )
}
