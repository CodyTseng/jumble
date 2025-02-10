import NoteList from '@/components/NoteList'
import RelayInfo from '@/components/RelayInfo'
import SaveRelayDropdownMenu from '@/components/SaveRelayDropdownMenu'
import { Button } from '@/components/ui/button'
import SecondaryPageLayout from '@/layouts/SecondaryPageLayout'
import { normalizeUrl, simplifyUrl } from '@/lib/url'
import { Check, Copy } from 'lucide-react'
import { forwardRef, useMemo, useState } from 'react'
import NotFoundPage from '../NotFoundPage'

const RelayPage = forwardRef(({ url, index }: { url?: string; index?: number }, ref) => {
  const normalizedUrl = useMemo(() => (url ? normalizeUrl(url) : undefined), [url])
  const title = useMemo(() => (url ? simplifyUrl(url) : undefined), [url])

  if (!normalizedUrl) {
    return <NotFoundPage ref={ref} />
  }

  return (
    <SecondaryPageLayout
      ref={ref}
      index={index}
      title={title}
      controls={<RelayPageControls url={normalizedUrl} />}
      displayScrollToTopButton
    >
      <RelayInfo url={normalizedUrl} />
      <NoteList relayUrls={[normalizedUrl]} needCheckAlgoRelay />
    </SecondaryPageLayout>
  )
})
RelayPage.displayName = 'RelayPage'
export default RelayPage

function RelayPageControls({ url }: { url: string }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = () => {
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <>
      <Button variant="ghost" size="titlebar-icon" onClick={handleCopy}>
        {copied ? <Check /> : <Copy />}
      </Button>
      <SaveRelayDropdownMenu urls={[url]} atTitlebar />
    </>
  )
}
