import { toRelaySettings } from '@/lib/link'
import { simplifyUrl } from '@/lib/url'
import { SecondaryPageLink } from '@/PageManager'
import { useFavoriteRelays } from '@/providers/FavoriteRelaysProvider'
import { useFeed } from '@/providers/FeedProvider'
import { useNostr } from '@/providers/NostrProvider'
import { UsersRound } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import RelayIcon from '../RelayIcon'
import RelaySetCard from '../RelaySetCard'

export default function FeedSwitcher({ close }: { close?: () => void }) {
  const { t } = useTranslation()
  const { pubkey } = useNostr()
  const { relaySets, favoriteRelays } = useFavoriteRelays()
  const { feedInfo, switchFeed } = useFeed()

  return (
    <div className="space-y-2">
      {pubkey && (
        <FeedSwitcherItem
          isActive={feedInfo.feedType === 'following'}
          onClick={() => {
            if (!pubkey) return
            switchFeed('following', { pubkey })
            close?.()
          }}
        >
          <div className="flex gap-2 items-center">
            <div className="flex justify-center items-center w-6 h-6 shrink-0">
              <UsersRound className="size-4" />
            </div>
            <div>{t('Following')}</div>
          </div>
        </FeedSwitcherItem>
      )}

      <div className="flex justify-end items-center text-sm">
        <SecondaryPageLink
          to={toRelaySettings()}
          className="text-primary font-semibold"
          onClick={() => close?.()}
        >
          {t('edit')}
        </SecondaryPageLink>
      </div>
      {relaySets
        .filter((set) => set.relayUrls.length > 0)
        .map((set) => (
          <RelaySetCard
            key={set.id}
            relaySet={set}
            select={feedInfo.feedType === 'relays' && set.id === feedInfo.id}
            onSelectChange={(select) => {
              if (!select) return
              switchFeed('relays', { activeRelaySetId: set.id })
              close?.()
            }}
          />
        ))}
      {favoriteRelays.map((relay) => (
        <FeedSwitcherItem
          key={relay}
          isActive={feedInfo.feedType === 'relay' && feedInfo.id === relay}
          onClick={() => {
            switchFeed('relay', { relay })
            close?.()
          }}
        >
          <div className="flex gap-2 items-center w-full">
            <RelayIcon url={relay} />
            <div className="flex-1 w-0 truncate">{simplifyUrl(relay)}</div>
          </div>
        </FeedSwitcherItem>
      ))}
    </div>
  )
}

function FeedSwitcherItem({
  children,
  isActive,
  onClick,
  controls
}: {
  children: React.ReactNode
  isActive: boolean
  onClick: () => void
  controls?: React.ReactNode
}) {
  return (
    <div
      className={`w-full border rounded-lg p-4 ${isActive ? 'border-primary bg-primary/5' : 'clickable'}`}
      onClick={onClick}
    >
      <div className="flex justify-between items-center">
        <div className="font-semibold flex-1">{children}</div>
        {controls}
      </div>
    </div>
  )
}
