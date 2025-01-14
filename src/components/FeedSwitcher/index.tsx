import { toRelaySettings } from '@/lib/link'
import { simplifyUrl } from '@/lib/url'
import { SecondaryPageLink } from '@/PageManager'
import { useFeed } from '@/providers/FeedProvider'
import { useNostr } from '@/providers/NostrProvider'
import { useRelaySets } from '@/providers/RelaySetsProvider'
import { Circle, CircleCheck } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import RelaySetCard from '../RelaySetCard'

export default function FeedSwitcher({ close }: { close?: () => void }) {
  const { t } = useTranslation()
  const { feedType, switchFeed, activeRelaySetId, temporaryRelayUrls } = useFeed()
  const { pubkey } = useNostr()
  const { relaySets } = useRelaySets()

  return (
    <div className="space-y-4">
      {pubkey && (
        <FeedSwitcherItem
          itemName={t('Following')}
          isActive={feedType === 'following'}
          onClick={() => {
            if (!pubkey) return
            switchFeed('following', { pubkey })
            close?.()
          }}
        />
      )}
      <div className="space-y-2">
        <div className="flex justify-between px-2">
          <div className="text-muted-foreground text-sm font-semibold">{t('relay sets')}</div>
          <SecondaryPageLink
            to={toRelaySettings()}
            className="text-highlight text-sm font-semibold"
            onClick={() => close?.()}
          >
            {t('edit')}
          </SecondaryPageLink>
        </div>
        {temporaryRelayUrls.length > 0 && (
          <FeedSwitcherItem
            key="temporary"
            itemName={
              temporaryRelayUrls.length === 1 ? simplifyUrl(temporaryRelayUrls[0]) : t('Temporary')
            }
            isActive={feedType === 'temporary'}
            temporary
            onClick={() => {
              switchFeed('temporary')
              close?.()
            }}
          />
        )}
        {relaySets
          .filter((set) => set.relayUrls.length > 0)
          .map((set) => (
            <RelaySetCard
              key={set.id}
              relaySet={set}
              select={feedType === 'relays' && set.id === activeRelaySetId}
              showConnectionStatus={feedType === 'relays' && set.id === activeRelaySetId}
              onSelectChange={(select) => {
                if (!select) return
                switchFeed('relays', { activeRelaySetId: set.id })
                close?.()
              }}
            />
          ))}
      </div>
    </div>
  )
}

function FeedSwitcherItem({
  itemName,
  isActive,
  temporary = false,
  onClick
}: {
  itemName: string
  isActive: boolean
  temporary?: boolean
  onClick: () => void
}) {
  return (
    <div
      className={`w-full border rounded-lg p-4 ${isActive ? 'border-highlight bg-highlight/5' : 'clickable'} ${temporary ? 'border-dashed' : ''}`}
      onClick={onClick}
    >
      <div className="flex space-x-2 items-center">
        <FeedToggle isActive={isActive} />
        <div className="font-semibold">{itemName}</div>
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
