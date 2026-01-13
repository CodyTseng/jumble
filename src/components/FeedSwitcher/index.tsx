import { toRelaySettings } from '@/lib/link'
import { simplifyUrl } from '@/lib/url'
import { cn } from '@/lib/utils'
import { SecondaryPageLink } from '@/PageManager'
import { useFavoriteRelays } from '@/providers/FavoriteRelaysProvider'
import { useFeed } from '@/providers/FeedProvider'
import { useNostr } from '@/providers/NostrProvider'
import { usePinnedUsers } from '@/providers/PinnedUsersProvider'
import { Settings2, Star, UsersRound } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import RelayIcon from '../RelayIcon'
import RelaySetCard from '../RelaySetCard'

export default function FeedSwitcher({ close }: { close?: () => void }) {
  const { t } = useTranslation()
  const { pubkey } = useNostr()
  const { relaySets, favoriteRelays } = useFavoriteRelays()
  const { feedInfo, switchFeed } = useFeed()
  const { pinnedPubkeySet } = usePinnedUsers()
  const filteredRelaySets = useMemo(
    () => relaySets.filter((set) => set.relayUrls.length > 0),
    [relaySets]
  )
  const hasRelays = filteredRelaySets.length > 0 || favoriteRelays.length > 0

  return (
    <div className="space-y-4">
      {/* Personal Feeds Section */}
      <div className="space-y-2">
        <SectionHeader title={t('Personal Feeds')} />
        <div className="space-y-1.5">
          <FeedSwitcherItem
            isActive={feedInfo?.feedType === 'following'}
            disabled={!pubkey}
            onClick={() => {
              if (!pubkey) return
              switchFeed('following', { pubkey })
              close?.()
            }}
          >
            <div className="flex gap-3 items-center">
              <div className="flex justify-center items-center size-6 shrink-0">
                <UsersRound className="size-5" />
              </div>
              <div className="flex-1">{t('Following')}</div>
            </div>
          </FeedSwitcherItem>

          <FeedSwitcherItem
            isActive={feedInfo?.feedType === 'pinned'}
            disabled={!pubkey || pinnedPubkeySet.size === 0}
            onClick={() => {
              if (!pubkey) return
              switchFeed('pinned', { pubkey })
              close?.()
            }}
          >
            <div className="flex gap-3 items-center">
              <div className="flex justify-center items-center size-6 shrink-0">
                <Star className="size-5" />
              </div>
              <div className="flex-1">{t('Special Follow')}</div>
            </div>
          </FeedSwitcherItem>
        </div>
      </div>

      {/* Relay Feeds Section */}
      {hasRelays && (
        <div className="space-y-2">
          <SectionHeader
            title={t('Relay Feeds')}
            action={
              <SecondaryPageLink
                to={toRelaySettings()}
                className="flex items-center gap-1 text-xs text-primary hover:text-primary-hover transition-colors font-medium"
                onClick={() => close?.()}
              >
                <Settings2 className="size-3" />
                {t('edit')}
              </SecondaryPageLink>
            }
          />
          <div className="space-y-1.5">
            {filteredRelaySets.map((set) => (
              <RelaySetCard
                key={set.id}
                relaySet={set}
                select={feedInfo?.feedType === 'relays' && set.id === feedInfo.id}
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
                isActive={feedInfo?.feedType === 'relay' && feedInfo.id === relay}
                onClick={() => {
                  switchFeed('relay', { relay })
                  close?.()
                }}
              >
                <div className="flex gap-3 items-center w-full">
                  <RelayIcon url={relay} className="shrink-0" />
                  <div className="flex-1 w-0 truncate">{simplifyUrl(relay)}</div>
                </div>
              </FeedSwitcherItem>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function SectionHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="flex justify-between items-center px-1 py-1">
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        {title}
      </h3>
      {action}
    </div>
  )
}

function FeedSwitcherItem({
  children,
  isActive,
  disabled,
  onClick
}: {
  children: React.ReactNode
  isActive: boolean
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <div
      className={cn(
        'group relative w-full border rounded-lg px-3 py-2.5 transition-all duration-200',
        disabled && 'opacity-50 pointer-events-none',
        isActive
          ? 'border-primary bg-primary/5 shadow-sm'
          : 'border-border hover:border-primary/50 hover:bg-accent/50 clickable'
      )}
      onClick={() => {
        if (disabled) return
        onClick()
      }}
    >
      <div className="flex justify-between items-center gap-2">
        <div className="font-medium flex-1 min-w-0">{children}</div>
      </div>
    </div>
  )
}
