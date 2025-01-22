import NoteList from '@/components/NoteList'
import { SEARCHABLE_RELAY_URLS } from '@/constants'
import { useFetchRelayInfos, useSearchParams } from '@/hooks'
import SecondaryPageLayout from '@/layouts/SecondaryPageLayout'
import { useFeed } from '@/providers/FeedProvider'
import { Filter } from 'nostr-tools'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

export default function NoteListPage({ index }: { index?: number }) {
  const { t } = useTranslation()
  const { relayUrls } = useFeed()
  const { searchableRelayUrls } = useFetchRelayInfos(relayUrls)
  const { searchParams } = useSearchParams()
  const {
    title = '',
    filter,
    urls
  } = useMemo<{
    title?: string
    filter?: Filter
    urls: string[]
  }>(() => {
    const hashtag = searchParams.get('t')
    if (hashtag) {
      return {
        title: `# ${hashtag}`,
        filter: { '#t': [hashtag] },
        urls: relayUrls,
        type: 'hashtag'
      }
    }
    const search = searchParams.get('s')
    if (search) {
      return {
        title: `${t('Search')}: ${search}`,
        filter: { search },
        urls: searchableRelayUrls.concat(SEARCHABLE_RELAY_URLS).slice(0, 4),
        type: 'search'
      }
    }
    return { urls: relayUrls }
  }, [searchParams, JSON.stringify(relayUrls)])

  return (
    <SecondaryPageLayout index={index} title={title} displayScrollToTopButton>
      <NoteList key={title} filter={filter} relayUrls={urls} />
    </SecondaryPageLayout>
  )
}
