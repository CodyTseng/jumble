import { SPECIAL_FEED_ID, TRENDING_NOTES_RELAY_URLS } from '@/constants'
import { simplifyUrl } from '@/lib/url'
import { useTranslation } from 'react-i18next'
import NormalFeed from '../NormalFeed'

const RESOURCE_DESCRIPTION = TRENDING_NOTES_RELAY_URLS.map((url) => simplifyUrl(url)).join(', ')

export default function TrendingNotes() {
  const { t } = useTranslation()

  return (
    <div>
      <div className="top-12 z-30 flex h-12 flex-col justify-center border-b bg-background px-4 text-lg font-bold">
        <div className="flex items-center gap-2">
          {t('Trending Notes')}
          <span className="text-sm font-normal text-muted-foreground">
            ({RESOURCE_DESCRIPTION})
          </span>
        </div>
      </div>
      <NormalFeed
        feedId={SPECIAL_FEED_ID.TRENDING}
        subRequests={[{ urls: TRENDING_NOTES_RELAY_URLS, filter: {} }]}
        showRelayCloseReason
      />
    </div>
  )
}
