import { toRelaySettings } from '@/lib/link'
import { simplifyUrl } from '@/lib/url'
import { SecondaryPageLink } from '@/PageManager'
import { useFeed } from '@/providers/FeedProvider'
import { useNostr } from '@/providers/NostrProvider'
import { useRelaySettings } from '@/providers/RelaySettingsProvider'
import { Circle, CircleCheck } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export default function FeedSwitcher({ close }: { close?: () => void }) {
  const { t } = useTranslation()
  const { feedType, setFeedType } = useFeed()
  const { pubkey } = useNostr()
  const { relayGroups, temporaryRelayUrls, switchRelayGroup } = useRelaySettings()

  return (
    <div className="space-y-4">
      {pubkey && (
        <FeedSwitcherItem
          itemName={t('Following')}
          isActive={feedType === 'following'}
          onClick={() => {
            setFeedType('following')
            close?.()
          }}
        />
      )}
      <div className="space-y-2">
        <div className="flex justify-between px-2">
          <div className="text-muted-foreground text-sm font-semibold">{t('relay feeds')}</div>
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
            isActive={feedType === 'relays'}
            temporary
            onClick={() => {
              setFeedType('relays')
              close?.()
            }}
          />
        )}
        {relayGroups
          .filter((group) => group.relayUrls.length > 0)
          .map((group) => (
            <FeedSwitcherItem
              key={group.groupName}
              itemName={
                group.relayUrls.length === 1 ? simplifyUrl(group.relayUrls[0]) : group.groupName
              }
              isActive={feedType === 'relays' && group.isActive && temporaryRelayUrls.length === 0}
              onClick={() => {
                switchRelayGroup(group.groupName)
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
