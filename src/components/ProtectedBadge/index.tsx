import { isProtectedEvent } from '@/lib/event'
import { Event } from 'nostr-tools'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

export default function ProtectedBadge({ event }: { event: Event }) {
  const { t } = useTranslation()
  const isProtected = useMemo(() => isProtectedEvent(event), [event])

  if (!isProtected) return null

  return (
    <div
      className="flex items-center rounded-full bg-green-500/10 px-2 py-0.5"
      title={t('Protected event (NIP-70)')}
    >
      <span className="text-xs leading-none text-green-600 dark:text-green-400">
        {t('Protected')}
      </span>
    </div>
  )
}
