import client from '@/services/client.service'
import { TRelaySet } from '@/types'
import { ChevronDown, Circle, CircleCheck, FolderClosed } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

export default function RelaySetCard({
  relaySet,
  select,
  onSelectChange,
  showConnectionStatus = false
}: {
  relaySet: TRelaySet
  select: boolean
  onSelectChange: (select: boolean) => void
  showConnectionStatus?: boolean
}) {
  const { t } = useTranslation()
  const [expand, setExpand] = useState(false)

  return (
    <div
      className={`w-full border rounded-lg px-4 py-3 ${select ? 'border-highlight bg-highlight/5' : 'clickable'}`}
      onClick={() => onSelectChange(!select)}
    >
      <div className="flex justify-between items-center">
        <div className="flex space-x-2 items-center cursor-pointer">
          <RelaySetActiveToggle select={select} />
          <div className="flex justify-center items-center w-6 h-6 shrink-0">
            <FolderClosed className="size-4" />
          </div>
          <div className="h-8 font-semibold flex items-center select-none">{relaySet.name}</div>
        </div>
        <div className="flex gap-1">
          <RelayUrlsExpandToggle expand={expand} onExpandChange={setExpand}>
            {t('n relays', { n: relaySet.relayUrls.length })}
          </RelayUrlsExpandToggle>
        </div>
      </div>
      {expand && (
        <RelayUrls urls={relaySet.relayUrls} showConnectionStatus={showConnectionStatus} />
      )}
    </div>
  )
}

function RelaySetActiveToggle({ select }: { select: boolean }) {
  return select ? (
    <CircleCheck size={18} className="text-highlight shrink-0" />
  ) : (
    <Circle size={18} className="shrink-0" />
  )
}

function RelayUrlsExpandToggle({
  children,
  expand,
  onExpandChange
}: {
  children: React.ReactNode
  expand: boolean
  onExpandChange: (expand: boolean) => void
}) {
  return (
    <div
      className="text-sm text-muted-foreground flex items-center gap-1 cursor-pointer hover:text-foreground"
      onClick={(e) => {
        e.stopPropagation()
        onExpandChange(!expand)
      }}
    >
      <div className="select-none">{children}</div>
      <ChevronDown
        size={16}
        className={`transition-transform duration-200 ${expand ? 'rotate-180' : ''}`}
      />
    </div>
  )
}

function RelayUrls({
  showConnectionStatus = false,
  urls
}: {
  showConnectionStatus?: boolean
  urls: string[]
}) {
  const [relays, setRelays] = useState<
    {
      url: string
      isConnected: boolean
    }[]
  >(urls.map((url) => ({ url, isConnected: false })) ?? [])

  useEffect(() => {
    if (!showConnectionStatus || urls.length === 0) return

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
  }, [showConnectionStatus, urls])

  if (!urls) return null

  return (
    <div>
      {relays.map(({ url, isConnected: isConnected }, index) => (
        <div key={index} className="flex items-center gap-2">
          {showConnectionStatus &&
            (isConnected ? (
              <div className="text-green-500 text-xs">●</div>
            ) : (
              <div className="text-red-500 text-xs">●</div>
            ))}
          <div className="text-muted-foreground text-sm">{url}</div>
        </div>
      ))}
    </div>
  )
}
