import { toRelaySettings } from '@/lib/link'
import { simplifyUrl } from '@/lib/url'
import { SecondaryPageLink } from '@/PageManager'
import { useFavoriteRelays } from '@/providers/FavoriteRelaysProvider'
import { useFeed } from '@/providers/FeedProvider'
import { useNip05Communities } from '@/providers/Nip05CommunitiesProvider'
import { useNostr } from '@/providers/NostrProvider'
import { Globe, UsersRound } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import RelayIcon from '../RelayIcon'
import RelaySetCard from '../RelaySetCard'
import { Button } from '../ui/button'

export default function FeedSwitcher({ close }: { close?: () => void }) {
  const { t } = useTranslation()
  const { pubkey, profile } = useNostr()
  const { relaySets, favoriteRelays } = useFavoriteRelays()
  const { communitySets, favoriteDomains } = useNip05Communities()
  const { feedInfo, switchFeed } = useFeed()

  // Extract user's NIP-05 domain
  const userDomain = pubkey && profile?.nip05 ? profile.nip05.split('@')[1]?.toLowerCase().trim() : null

  // Default to communities mode if user is viewing a community feed
  const defaultMode = feedInfo.feedType === 'nip05-domain' || feedInfo.feedType === 'nip05-domains'
    ? 'communities'
    : 'relays'
  const [mode, setMode] = useState<'relays' | 'communities'>(defaultMode)

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

      {/* Mode Toggle */}
      <div className="flex gap-2 p-1 bg-muted rounded-lg">
        <Button
          variant={mode === 'relays' ? 'default' : 'ghost'}
          size="sm"
          className="flex-1"
          onClick={() => setMode('relays')}
        >
          {t('Relays')}
        </Button>
        <Button
          variant={mode === 'communities' ? 'default' : 'ghost'}
          size="sm"
          className="flex-1"
          onClick={() => setMode('communities')}
        >
          {t('Communities')}
        </Button>
      </div>

      <div className="flex justify-end items-center text-sm">
        <SecondaryPageLink
          to={toRelaySettings()}
          className="text-primary font-semibold"
          onClick={() => close?.()}
        >
          {t('edit')}
        </SecondaryPageLink>
      </div>

      {mode === 'relays' ? (
        <>
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
        </>
      ) : (
        <>
          {/* User's own community */}
          {userDomain && (
            <FeedSwitcherItem
              isActive={feedInfo.feedType === 'nip05-domain' && feedInfo.id === userDomain}
              onClick={() => {
                switchFeed('nip05-domain', { domain: userDomain })
                close?.()
              }}
            >
              <div className="flex gap-2 items-center w-full">
                <Globe className="size-5 text-primary" />
                <div className="flex-1 w-0 truncate">
                  <div className="font-semibold">{t('My Community')}</div>
                  <div className="text-xs text-muted-foreground">{userDomain}</div>
                </div>
              </div>
            </FeedSwitcherItem>
          )}

          {communitySets
            .filter((set) => set.domains.length > 0)
            .map((set) => (
              <CommunitySetCard
                key={set.id}
                communitySet={set}
                select={feedInfo.feedType === 'nip05-domains' && set.id === feedInfo.id}
                onSelectChange={(select) => {
                  if (!select) return
                  switchFeed('nip05-domains', { activeCommunitySetId: set.id })
                  close?.()
                }}
              />
            ))}
          {favoriteDomains
            .filter((domain) => domain !== userDomain) // Don't duplicate user's domain
            .map((domain) => (
              <FeedSwitcherItem
                key={domain}
                isActive={feedInfo.feedType === 'nip05-domain' && feedInfo.id === domain}
                onClick={() => {
                  switchFeed('nip05-domain', { domain })
                  close?.()
                }}
              >
                <div className="flex gap-2 items-center w-full">
                  <Globe className="size-5 text-muted-foreground" />
                  <div className="flex-1 w-0 truncate">{domain}</div>
                </div>
              </FeedSwitcherItem>
            ))}
        </>
      )}
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

function CommunitySetCard({
  communitySet,
  select,
  onSelectChange
}: {
  communitySet: { id: string; name: string; domains: string[] }
  select: boolean
  onSelectChange: (select: boolean) => void
}) {
  const { t } = useTranslation()
  const [expand, setExpand] = useState(false)

  return (
    <div
      className={`w-full border rounded-lg p-4 clickable ${select ? 'border-primary bg-primary/5' : ''}`}
      onClick={() => onSelectChange(!select)}
    >
      <div className="flex justify-between items-center">
        <div className="flex space-x-2 items-center cursor-pointer">
          <div className="flex justify-center items-center w-6 h-6 shrink-0">
            <Globe className="size-4" />
          </div>
          <div className="h-8 font-semibold flex items-center select-none">{communitySet.name}</div>
        </div>
        <div className="flex gap-1">
          <div
            className="text-sm text-muted-foreground flex items-center gap-1 cursor-pointer hover:text-foreground"
            onClick={(e) => {
              e.stopPropagation()
              setExpand(!expand)
            }}
          >
            <div className="select-none">{t('n domains', { n: communitySet.domains.length })}</div>
          </div>
        </div>
      </div>
      {expand && (
        <div className="pl-1 space-y-1 mt-2">
          {communitySet.domains.map((domain) => (
            <div key={domain} className="flex items-center gap-3">
              <Globe className="w-4 h-4 text-muted-foreground" />
              <div className="text-muted-foreground text-sm truncate">{domain}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
