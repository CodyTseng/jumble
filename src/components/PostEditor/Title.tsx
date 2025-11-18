import { Event } from 'nostr-tools'
import { useTranslation } from 'react-i18next'

export default function Title({ parentStuff }: { parentStuff?: Event | string }) {
  const { t } = useTranslation()

  return parentStuff ? (
    <div className="flex gap-2 items-center w-full">
      <div className="shrink-0">{t('Reply to')}</div>
      {typeof parentStuff === 'string' && (
        <div className="text-primary truncate">{parentStuff}</div>
      )}
    </div>
  ) : (
    t('New Note')
  )
}
