import { NIP_34_TYPE_LABELS, getNip34EventMetadata } from '@/lib/nip34'
import { cn } from '@/lib/utils'
import { Event } from 'nostr-tools'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

export default function Nip34EventPreview({
  event,
  className
}: {
  event: Event
  className?: string
}) {
  const { t } = useTranslation()
  const metadata = useMemo(() => getNip34EventMetadata(event), [event])
  if (!metadata) return null

  return (
    <div className={cn('pointer-events-none truncate', className)}>
      <span className="shrink-0">[{t(NIP_34_TYPE_LABELS[metadata.type])}]</span>{' '}
      {metadata.title && (
        <span dir="auto" className="pe-0.5 italic">
          {metadata.title}
        </span>
      )}
    </div>
  )
}
