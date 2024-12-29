import { Event } from 'nostr-tools'
import { useTranslation } from 'react-i18next'
import { SimpleUserAvatar } from '../UserAvatar'

export default function Title({ parentEvent }: { parentEvent?: Event }) {
  const { t } = useTranslation()

  return parentEvent ? (
    <div className="flex gap-2 items-center w-full">
      <div className="shrink-0">{t('Reply to')}</div>
      <SimpleUserAvatar userId={parentEvent.pubkey} size="tiny" />
      <div className="flex-1 w-0 truncate">{parentEvent.content}</div>
    </div>
  ) : (
    t('New post')
  )
}
