import PinButton from '@/components/PinButton'
import Relay from '@/components/Relay'
import PrimaryPageLayout from '@/layouts/PrimaryPageLayout'
import { normalizeUrl, simplifyUrl } from '@/lib/url'
import { Box } from 'lucide-react'
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
    <div className="flex items-center justify-between gap-2 px-3 h-full">
      <div className="flex items-center gap-2 min-w-0 [&_svg]:text-muted-foreground">
        <Box className="shrink-0" />
        <div className="text-lg font-semibold truncate" style={{ fontSize: `var(--title-font-size, 18px)` }}>{simplifyUrl(url ?? '')}</div>
      </div>
      {url && <PinButton column={{ type: 'relay', props: { url } }} size="titlebar-icon" />}
    </div>
  )
}
