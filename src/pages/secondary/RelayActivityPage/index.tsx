import { useSecondaryPage } from '@/PageManager'
import { Button } from '@/components/ui/button'
import { toRelay } from '@/lib/link'
import { Server } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import RelayObservations from '@/components/RelayObservations'
import SecondaryPageLayout from '@/layouts/SecondaryPageLayout'
import { isWebsocketUrl, normalizeUrl, simplifyUrl } from '@/lib/url'
import { forwardRef, useMemo } from 'react'
import NotFoundPage from '../NotFoundPage'

const RelayActivityPage = forwardRef(({ url, index }: { url?: string; index?: number }, ref) => {
  const { t } = useTranslation()
  const { push } = useSecondaryPage()
  const normalizedUrl = useMemo(() => (url ? normalizeUrl(url) : undefined), [url])

  if (!normalizedUrl || !isWebsocketUrl(normalizedUrl)) {
    return <NotFoundPage ref={ref} />
  }

  return (
    <SecondaryPageLayout
      ref={ref}
      index={index}
      title={simplifyUrl(normalizedUrl)}
      controls={
        <Button variant="ghost" size="sm" onClick={() => push(toRelay(normalizedUrl))}>
          <Server className="size-4" />
          {t('View')}
        </Button>
      }
    >
      <div className="space-y-4 px-4 py-4">
        <p className="text-muted-foreground text-sm">
          {t(
            'These statistics summarize data recorded while using Jumble on this device and do not represent comprehensive monitoring of the relay.'
          )}
        </p>
        <RelayObservations url={normalizedUrl} />
      </div>
    </SecondaryPageLayout>
  )
})
RelayActivityPage.displayName = 'RelayActivityPage'
export default RelayActivityPage
