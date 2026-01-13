import NoteList from '@/components/NoteList'
import { ExtendedKind } from '@/constants'
import SecondaryPageLayout from '@/layouts/SecondaryPageLayout'
import { getDefaultRelayUrls } from '@/lib/relay'
import { normalizeUrl, simplifyUrl } from '@/lib/url'
import { forwardRef, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import NotFoundPage from '../NotFoundPage'

const RelayReviewsPage = forwardRef(({ url, index }: { url?: string; index?: number }, ref) => {
  const { t } = useTranslation()
  const normalizedUrl = useMemo(() => (url ? normalizeUrl(url) : undefined), [url])
  const title = useMemo(
    () => (url ? t('Reviews for {{relay}}', { relay: simplifyUrl(url) }) : undefined),
    [url]
  )

  if (!normalizedUrl) {
    return <NotFoundPage ref={ref} />
  }

  return (
    <SecondaryPageLayout ref={ref} index={index} title={title} displayScrollToTopButton>
      <NoteList
        showKinds={[ExtendedKind.RELAY_REVIEW]}
        subRequests={[
          {
            urls: [normalizedUrl, ...getDefaultRelayUrls()],
            filter: { '#d': [normalizedUrl] }
          }
        ]}
        hideSpam
      />
    </SecondaryPageLayout>
  )
})
RelayReviewsPage.displayName = 'RelayReviewsPage'
export default RelayReviewsPage
