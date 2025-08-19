import { TMailboxRelay } from '@/types'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import AlertCard from '../AlertCard'

export default function RelayCountWarning({ relays }: { relays: TMailboxRelay[] }) {
  const { t } = useTranslation()
  const readRelayCount = useMemo(() => {
    return relays.filter((r) => r.scope !== 'write').length
  }, [relays])
  const writeRelayCount = useMemo(() => {
    return relays.filter((r) => r.scope !== 'read').length
  }, [relays])
  const showReadWarning = readRelayCount > 4
  const showWriteWarning = writeRelayCount > 4

  if (!showReadWarning && !showWriteWarning) {
    return null
  }

  return (
    <AlertCard
      title={showReadWarning ? t('Too many read relays') : t('Too many write relays')}
      content={
        showReadWarning
          ? t(
              'You have {{count}} read relays. Most clients only use 2-4 relays, setting more is unnecessary.',
              { count: readRelayCount }
            )
          : t(
              'You have {{count}} write relays. Most clients only use 2-4 relays, setting more is unnecessary.',
              { count: writeRelayCount }
            )
      }
    />
  )
}
