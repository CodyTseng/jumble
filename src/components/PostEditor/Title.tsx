import { Event } from 'nostr-tools'
import { useTranslation } from 'react-i18next'

export default function Title({ parentEvent }: { parentEvent?: Event }) {
  const { t } = useTranslation()

  return parentEvent ? (
    <div className="flex gap-2 items-center w-full">
      <div className="shrink-0">{t('Reply to')}</div>
    </div>
  ) : (
    t('New Note')
  )
}
