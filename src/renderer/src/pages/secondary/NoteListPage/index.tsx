import NoteList from '@renderer/components/NoteList'
import { useSearchParams } from '@renderer/hooks'
import SecondaryPageLayout from '@renderer/layouts/SecondaryPageLayout'
import { isWebsocketUrl } from '@renderer/lib/url'
import { useRelaySettings } from '@renderer/providers/RelaySettingsProvider'
import { Filter } from 'nostr-tools'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

export default function NoteListPage() {
  const { t } = useTranslation()
  const { relayUrls, searchableRelayUrls } = useRelaySettings()
  const { searchParams } = useSearchParams()
  const {
    title = '',
    filter,
    specificRelayUrl
  } = useMemo<{
    title?: string
    filter?: Filter
    specificRelayUrl?: string
  }>(() => {
    const hashtag = searchParams.get('t')
    if (hashtag) {
      return { title: `# ${hashtag}`, filter: { '#t': [hashtag] } }
    }
    const search = searchParams.get('s')
    if (search) {
      return { title: `${t('search')}: ${search}`, filter: { search } }
    }
    const relayUrl = searchParams.get('relay')
    if (relayUrl && isWebsocketUrl(relayUrl)) {
      return { title: relayUrl, specificRelayUrl: relayUrl }
    }
    return {}
  }, [searchParams])

  if (filter?.search && searchableRelayUrls.length === 0) {
    return (
      <SecondaryPageLayout titlebarContent={title}>
        <div className="text-center text-sm text-muted-foreground">
          {t('The relays you are connected to do not support search')}
        </div>
      </SecondaryPageLayout>
    )
  }

  return (
    <SecondaryPageLayout titlebarContent={title}>
      <NoteList
        key={title}
        filter={filter}
        relayUrls={specificRelayUrl ? [specificRelayUrl] : relayUrls}
      />
    </SecondaryPageLayout>
  )
}
