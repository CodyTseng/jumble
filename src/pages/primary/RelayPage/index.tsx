import Relay from '@/components/Relay'
import PrimaryPageLayout from '@/layouts/PrimaryPageLayout'
import { normalizeUrl, simplifyUrl } from '@/lib/url'
import { Server } from 'lucide-react'
import { forwardRef, useMemo } from 'react'

const RelayPage = forwardRef(({ url }: { url?: string }, ref) => {
  const normalizedUrl = useMemo(() => (url ? normalizeUrl(url) : undefined), [url])

  return (
    <PrimaryPageLayout
      pageName="relay"
      titlebar={<RelayPageTitlebar url={normalizedUrl} />}
      displayScrollToTopButton
      ref={ref}
    >
      <Relay url={normalizedUrl} />
    </PrimaryPageLayout>
  )
})
RelayPage.displayName = 'RelayPage'
export default RelayPage

function RelayPageTitlebar({ url }: { url?: string }) {
  return (
    <div className="flex items-center gap-2 px-3 h-full">
      <Server />
      <div className="text-lg font-semibold truncate">{simplifyUrl(url ?? '')}</div>
    </div>
  )
}
