import NoteList from '@/components/NoteList'
import RelayInfo from '@/components/RelayInfo'
import SaveRelayDropdownMenu from '@/components/SaveRelayDropdownMenu'
import SearchInput from '@/components/SearchInput'
import { Button } from '@/components/ui/button'
import { useFetchRelayInfo } from '@/hooks'
import SecondaryPageLayout from '@/layouts/SecondaryPageLayout'
import { normalizeUrl, simplifyUrl } from '@/lib/url'
import { Check, Copy } from 'lucide-react'
import { forwardRef, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import NotFoundPage from '../NotFoundPage'

const RelayPage = forwardRef(({ url, index }: { url?: string; index?: number }, ref) => {
  const { t } = useTranslation()
  const normalizedUrl = useMemo(() => (url ? normalizeUrl(url) : undefined), [url])
  const { relayInfo } = useFetchRelayInfo(normalizedUrl)
  const title = useMemo(() => (url ? simplifyUrl(url) : undefined), [url])
  const [searchInput, setSearchInput] = useState('')
  const [debouncedInput, setDebouncedInput] = useState(searchInput)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedInput(searchInput)
    }, 1000)

    return () => {
      clearTimeout(handler)
    }
  }, [searchInput])

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
      {relayInfo?.supported_nips?.includes(50) && (
        <div className="px-4 py-2">
          <SearchInput
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={t('Search')}
          />
        </div>
      )}
      <NoteList
        relayUrls={[normalizedUrl]}
        needCheckAlgoRelay
        filter={debouncedInput ? { search: debouncedInput } : {}}
      />
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
