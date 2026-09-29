import NormalFeed from '@/components/NormalFeed'
import RelayInfo from '@/components/RelayInfo'
import SearchInput from '@/components/SearchInput'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useFetchRelayInfo } from '@/hooks'
import { normalizeUrl } from '@/lib/url'
import { useCurrentRelays } from '@/providers/CurrentRelaysProvider'
import { useFollowList } from '@/providers/FollowListProvider'
import storage from '@/services/local-storage.service'
import { Event } from 'nostr-tools'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import NotFound from '../NotFound'

export default function Relay({ url, className }: { url?: string; className?: string }) {
  const { t } = useTranslation()
  const { addRelayUrls, removeRelayUrls } = useCurrentRelays()
  const normalizedUrl = useMemo(() => (url ? normalizeUrl(url) : undefined), [url])
  const { relayInfo } = useFetchRelayInfo(normalizedUrl)
  const [searchInput, setSearchInput] = useState('')
  const [debouncedInput, setDebouncedInput] = useState(searchInput)
  const { followingSet } = useFollowList()
  const feedKey = normalizedUrl ? `relay-${normalizedUrl}` : ''
  const [hideFollowedUsers, setHideFollowedUsers] = useState(() =>
    feedKey ? storage.getHideFollowedUsersForFeed(feedKey) : false
  )

  useEffect(() => {
    if (feedKey) {
      setHideFollowedUsers(storage.getHideFollowedUsersForFeed(feedKey))
    }
  }, [feedKey])

  useEffect(() => {
    if (normalizedUrl) {
      addRelayUrls([normalizedUrl])
      return () => {
        removeRelayUrls([normalizedUrl])
      }
    }
  }, [normalizedUrl])

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedInput(searchInput)
    }, 1000)

    return () => {
      clearTimeout(handler)
    }
  }, [searchInput])

  const handleToggleChange = (checked: boolean) => {
    if (!feedKey) return
    setHideFollowedUsers(checked)
    storage.setHideFollowedUsersForFeed(feedKey, checked)
  }

  const filterFn = useMemo(() => {
    if (!hideFollowedUsers) return undefined
    return (event: Event) => !followingSet.has(event.pubkey)
  }, [hideFollowedUsers, followingSet])

  if (!normalizedUrl) {
    return <NotFound />
  }

  return (
    <div className={className}>
      <RelayInfo url={normalizedUrl} className="pt-3" />
      <div className="px-4 py-3 flex items-center justify-between border-b">
        <Label htmlFor="hide-followed" className="text-sm font-medium cursor-pointer">
          {t('Hide posts from followed users')}
        </Label>
        <Switch
          id="hide-followed"
          checked={hideFollowedUsers}
          onCheckedChange={handleToggleChange}
        />
      </div>
      {relayInfo?.supported_nips?.includes(50) && (
        <div className="px-4 py-2">
          <SearchInput
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={t('Search')}
          />
        </div>
      )}
      <NormalFeed
        feedId={`relay-${normalizedUrl}`}
        subRequests={[
          { urls: [normalizedUrl], filter: debouncedInput ? { search: debouncedInput } : {} }
        ]}
        showRelayCloseReason
        filterFn={filterFn}
      />
    </div>
  )
}
