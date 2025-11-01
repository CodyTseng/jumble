import { toRelaySettings } from '@/lib/link'
import { simplifyUrl } from '@/lib/url'
import { SecondaryPageLink } from '@/PageManager'
import { useCustomFeeds } from '@/providers/CustomFeedsProvider'
import { useFavoriteRelays } from '@/providers/FavoriteRelaysProvider'
import { useFeed } from '@/providers/FeedProvider'
import { useNostr } from '@/providers/NostrProvider'
import { BookmarkIcon, Hash, Highlighter, Search, Trash2, UsersRound } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import PinButton from '../PinButton'
import { Button } from '../ui/button'
import RelayIcon from '../RelayIcon'
import RelaySetCard from '../RelaySetCard'

export default function FeedSwitcher({ close }: { close?: () => void }) {
  const { t } = useTranslation()
  const { pubkey } = useNostr()
  const { relaySets, favoriteRelays } = useFavoriteRelays()
  const { feedInfo, switchFeed } = useFeed()
  const { customFeeds, removeCustomFeed } = useCustomFeeds()

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

      {pubkey && (
        <FeedSwitcherItem
          isActive={feedInfo.feedType === 'bookmarks'}
          onClick={() => {
            if (!pubkey) return
            switchFeed('bookmarks', { pubkey })
            close?.()
          }}
          controls={
            <PinButton
              column={{ type: 'bookmarks' }}
              className="opacity-0 group-hover:opacity-100 transition-opacity"
            />
          }
        >
          <div className="flex gap-2 items-center">
            <div className="flex justify-center items-center w-6 h-6 shrink-0">
              <BookmarkIcon className="size-4" />
            </div>
            <div>{t('Bookmarks')}</div>
          </div>
        </FeedSwitcherItem>
      )}

      {pubkey && (
        <FeedSwitcherItem
          isActive={feedInfo.feedType === 'highlights'}
          onClick={() => {
            if (!pubkey) return
            switchFeed('highlights', { pubkey })
            close?.()
          }}
          controls={
            <PinButton
              column={{ type: 'highlights' }}
              className="opacity-0 group-hover:opacity-100 transition-opacity"
            />
          }
        >
          <div className="flex gap-2 items-center">
            <div className="flex justify-center items-center w-6 h-6 shrink-0">
              <Highlighter className="size-4" />
            </div>
            <div>{t('Highlights')}</div>
          </div>
        </FeedSwitcherItem>
      )}

      {customFeeds.length > 0 && (
        <>
          <div className="text-xs font-semibold mt-4 mb-2">
            {t('Custom Feeds')}
          </div>
          {customFeeds.map((feed) => (
            <FeedSwitcherItem
              key={feed.id}
              isActive={feedInfo.feedType === 'custom' && feedInfo.id === feed.id}
              onClick={() => {
                switchFeed('custom', { customFeedId: feed.id })
                close?.()
              }}
              controls={
                <div className="flex gap-1 items-center">
                  <PinButton
                    column={{
                      type: 'custom',
                      props: { customFeedId: feed.id }
                    }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation()
                      removeCustomFeed(feed.id)
                    }}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              }
            >
              <div className="flex gap-2 items-center">
                <div className="flex justify-center items-center w-6 h-6 shrink-0">
                  {feed.searchParams.type === 'hashtag' ? (
                    <Hash className="size-4" />
                  ) : (
                    <Search className="size-4" />
                  )}
                </div>
                <div className="truncate">{feed.name}</div>
              </div>
            </FeedSwitcherItem>
          ))}
        </>
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
          controls={
            <PinButton
              column={{
                type: 'relay',
                props: { url: relay }
              }}
              className="opacity-0 group-hover:opacity-100 transition-opacity"
            />
          }
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
      className={`w-full border rounded-lg py-1 px-3 group ${isActive ? 'border-primary bg-primary/5' : 'clickable'}`}
      onClick={onClick}
      style={{ fontSize: 'var(--font-size, 14px)' }}
    >
      <div className="flex justify-between items-center">
        <div className="font-semibold flex-1">{children}</div>
        {controls}
      </div>
    </div>
  )
}
