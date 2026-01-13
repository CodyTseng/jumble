import { SEARCHABLE_RELAY_URLS } from '@/constants'
import { getDefaultRelayUrls } from '@/lib/relay'
import { TSearchParams } from '@/types'
import NormalFeed from '../NormalFeed'
import Profile from '../Profile'
import { ProfileListBySearch } from '../ProfileListBySearch'
import Relay from '../Relay'
import TrendingNotes from '../TrendingNotes'

export default function SearchResult({ searchParams }: { searchParams: TSearchParams | null }) {
  if (!searchParams) {
    return <TrendingNotes />
  }
  if (searchParams.type === 'profile') {
    return <Profile id={searchParams.search} />
  }
  if (searchParams.type === 'profiles') {
    return <ProfileListBySearch search={searchParams.search} />
  }
  if (searchParams.type === 'notes') {
    return (
      <NormalFeed
        subRequests={[{ urls: SEARCHABLE_RELAY_URLS, filter: { search: searchParams.search } }]}
        showRelayCloseReason
      />
    )
  }
  if (searchParams.type === 'hashtag') {
    return (
      <NormalFeed
        subRequests={[{ urls: getDefaultRelayUrls(), filter: { '#t': [searchParams.search] } }]}
        showRelayCloseReason
      />
    )
  }
  if (searchParams.type === 'nak') {
    return <NormalFeed subRequests={[searchParams.request]} showRelayCloseReason />
  }
  return <Relay url={searchParams.search} />
}
