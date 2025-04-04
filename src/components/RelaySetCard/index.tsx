import { TRelaySet } from '@/types'
import { ChevronDown, Circle, CircleCheck, FolderClosed } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import RelayIcon from '../RelayIcon'

export default function RelaySetCard({
  relaySet,
  select,
  onSelectChange
}: {
  relaySet: TRelaySet
  select: boolean
  onSelectChange: (select: boolean) => void
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
      {expand && <RelayUrls urls={relaySet.relayUrls} />}
    </div>
  )
}

function RelaySetActiveToggle({ select }: { select: boolean }) {
  return select ? (
    <CircleCheck className="text-highlight shrink-0 size-4" />
  ) : (
    <Circle className="shrink-0 size-4" />
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

function RelayUrls({ urls }: { urls: string[] }) {
  if (!urls) return null

  return (
    <div className="pl-7 space-y-1">
      {urls.map((url) => (
        <div key={url} className="flex items-center gap-2">
          <RelayIcon url={url} className="w-4 h-4" iconSize={10} />
          <div className="text-muted-foreground text-sm truncate">{url}</div>
        </div>
      ))}
    </div>
  )
}
