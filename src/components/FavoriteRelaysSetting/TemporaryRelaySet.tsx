import { useFetchRelayInfos } from '@/hooks'
import { useFeed } from '@/providers/FeedProvider'
import client from '@/services/client.service'
import { SearchCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import SaveRelayDropdownMenu from '../SaveRelayDropdownMenu'

export default function TemporaryRelaySet() {
  const { t } = useTranslation()
  const { temporaryRelayUrls } = useFeed()
  const [relays, setRelays] = useState<
    {
      url: string
      isConnected: boolean
    }[]
  >(temporaryRelayUrls.map((url) => ({ url, isConnected: false })))
  const { relayInfos } = useFetchRelayInfos(relays.map((relay) => relay.url))

  useEffect(() => {
    const interval = setInterval(() => {
      const connectionStatusMap = client.listConnectionStatus()
      setRelays((pre) => {
        return pre.map((relay) => {
          const isConnected = connectionStatusMap.get(relay.url) || false
          return { ...relay, isConnected }
        })
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    setRelays(temporaryRelayUrls.map((url) => ({ url, isConnected: false })))
  }, [temporaryRelayUrls])

  if (!relays.length) {
    return null
  }

  return (
    <div className="w-full border border-dashed rounded-lg p-4 border-highlight bg-highlight/5 flex gap-4 justify-between">
      <div>
        <div className="flex justify-between items-center">
          <div className="h-8 font-semibold">Temporary</div>
        </div>
        {relays.map((relay, index) => (
          <div key={index} className="flex items-center justify-between">
            <div className="flex gap-2 items-center">
              {relay.isConnected ? (
                <div className="text-green-500 text-xs">●</div>
              ) : (
                <div className="text-red-500 text-xs">●</div>
              )}
              <div className="text-muted-foreground text-sm">{relay.url}</div>
              {relayInfos[index]?.supported_nips?.includes(50) && (
                <div title={t('supports search')} className="text-highlight">
                  <SearchCheck size={14} />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      <SaveRelayDropdownMenu urls={temporaryRelayUrls} />
    </div>
  )
}
