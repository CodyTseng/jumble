import { VITE_DEFAULT_RELAY_SETS } from '@/constants'
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
  const filteredRelaySets = useMemo(() => {
    if (relaySets.length === 0 && VITE_DEFAULT_RELAY_SETS.length > 0) {
      return [...VITE_DEFAULT_RELAY_SETS]
    }
    return relaySets.filter((set) => set.relayUrls.length > 0)
  }, [relaySets])
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
            <div className="flex items-center gap-3">
              <div className="flex size-6 shrink-0 items-center justify-center">
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
            <div className="flex items-center gap-3">
              <div className="flex size-6 shrink-0 items-center justify-center">
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
                className="flex items-center gap-1 text-xs font-medium text-primary transition-colors hover:text-primary-hover"
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
                <div className="flex w-full items-center gap-3">
                  <RelayIcon url={relay} className="shrink-0" />
                  <div className="w-0 flex-1 truncate">{simplifyUrl(relay)}</div>
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
    <div className="flex items-center justify-between px-1 py-1">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
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
        'group relative w-full rounded-lg border px-3 py-2.5 transition-all duration-200',
        disabled && 'pointer-events-none opacity-50',
        isActive
          ? 'border-primary bg-primary/5 shadow-sm'
          : 'clickable border-border hover:border-primary/50 hover:bg-accent/50'
      )}
      onClick={() => {
        if (disabled) return
        onClick()
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1 font-medium">{children}</div>
      </div>
    </div>
  )
}
