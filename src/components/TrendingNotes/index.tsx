import { TRENDING_NOTES_RELAY_URLS } from '@/constants'
import { simplifyUrl } from '@/lib/url'
import { useTranslation } from 'react-i18next'
import NormalFeed from '../NormalFeed'

const RESOURCE_DESCRIPTION = TRENDING_NOTES_RELAY_URLS.map((url) => simplifyUrl(url)).join(', ')

export default function TrendingNotes() {
  const { t } = useTranslation()

  return (
    <div>
      <div className="top-12 h-12 px-4 flex flex-col justify-center text-lg font-bold bg-background z-30 border-b">
        <div className="flex items-center gap-2">
          {t('Trending Notes')}
          <span className="text-sm text-muted-foreground font-normal">
            ({RESOURCE_DESCRIPTION})
          </span>
        </div>
      </div>
      <NormalFeed
        subRequests={[{ urls: TRENDING_NOTES_RELAY_URLS, filter: {} }]}
        showRelayCloseReason
      />
    </div>
  )
}
