import { toRelaySettings } from '@/lib/link'
import { simplifyUrl } from '@/lib/url'
import { SecondaryPageLink } from '@/PageManager'
import { useFavoriteRelays } from '@/providers/FavoriteRelaysProvider'
import { useFeed } from '@/providers/FeedProvider'
import { useNostr } from '@/providers/NostrProvider'
import { Circle, CircleCheck } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import RelayIcon from '../RelayIcon'
import RelaySetCard from '../RelaySetCard'
import SaveRelayDropdownMenu from '../SaveRelayDropdownMenu'

export default function FeedSwitcher({ close }: { close?: () => void }) {
  const { t } = useTranslation()
  const { pubkey } = useNostr()
  const { relaySets, favoriteRelays } = useFavoriteRelays()
  const { feedInfo, switchFeed, temporaryRelayUrls } = useFeed()

  return (
    <div className="space-y-4">
      {pubkey && (
        <FeedSwitcherItem
          isActive={feedInfo.feedType === 'following'}
          onClick={() => {
            if (!pubkey) return
            switchFeed('following', { pubkey })
            close?.()
          }}
        >
          {t('Following')}
        </FeedSwitcherItem>
      )}
      {temporaryRelayUrls.length > 0 && (
        <FeedSwitcherItem
          key="temporary"
          isActive={feedInfo.feedType === 'temporary'}
          temporary
          onClick={() => {
            switchFeed('temporary')
            close?.()
          }}
          controls={<SaveRelayDropdownMenu urls={temporaryRelayUrls} />}
        >
          {temporaryRelayUrls.length === 1 ? simplifyUrl(temporaryRelayUrls[0]) : t('Temporary')}
        </FeedSwitcherItem>
      )}
      <div className="space-y-2">
        <div className="flex justify-end items-center text-sm">
          <SecondaryPageLink
            to={toRelaySettings()}
            className="text-highlight font-semibold"
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
              showConnectionStatus={feedInfo.feedType === 'relays' && set.id === feedInfo.id}
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
    </div>
  )
}

function FeedSwitcherItem({
  children,
  isActive,
  temporary = false,
  onClick,
  controls
}: {
  children: React.ReactNode
  isActive: boolean
  temporary?: boolean
  onClick: () => void
  controls?: React.ReactNode
}) {
  return (
    <div
      className={`w-full border rounded-lg px-4 py-3 ${isActive ? 'border-highlight bg-highlight/5' : 'clickable'} ${temporary ? 'border-dashed' : ''}`}
      onClick={onClick}
    >
      <div className="flex justify-between items-center">
        <div className="flex gap-2 items-center flex-1">
          <FeedToggle isActive={isActive} />
          <div className="font-semibold flex-1">{children}</div>
        </div>
        {controls}
      </div>
    </div>
  )
}

function FeedToggle({ isActive }: { isActive: boolean }) {
  return isActive ? (
    <CircleCheck size={18} className="text-highlight shrink-0" />
  ) : (
    <Circle size={18} className="text-muted-foreground shrink-0" />
  )
}
