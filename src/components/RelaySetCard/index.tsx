import { cn } from '@/lib/utils'
import { TRelaySet } from '@/types'
import { ChevronDown, FolderClosed } from 'lucide-react'
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
      className={cn(
        'group relative w-full border rounded-lg px-3 py-2.5 transition-all duration-200',
        select
          ? 'border-primary bg-primary/5 shadow-sm'
          : 'border-border hover:border-primary/50 hover:bg-accent/50 clickable'
      )}
      onClick={() => onSelectChange(!select)}
    >
      <div className="flex justify-between items-center gap-2">
        <div className="flex gap-3 items-center flex-1 min-w-0">
          <div className="flex justify-center items-center size-6 shrink-0">
            <FolderClosed className="size-5" />
          </div>
          <div className="font-medium select-none truncate">{relaySet.name}</div>
        </div>
        <div className="flex gap-1 items-center shrink-0">
          <RelayUrlsExpandToggle expand={expand} onExpandChange={setExpand}>
            {t('n relays', { n: relaySet.relayUrls.length })}
          </RelayUrlsExpandToggle>
        </div>
      </div>
      {expand && <RelayUrls urls={relaySet.relayUrls} />}
    </div>
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
      className="text-xs text-muted-foreground flex items-center gap-0.5 cursor-pointer hover:text-foreground transition-colors"
      onClick={(e) => {
        e.stopPropagation()
        onExpandChange(!expand)
      }}
    >
      <div className="select-none font-medium">{children}</div>
      <ChevronDown
        size={14}
        className={cn('transition-transform duration-200', expand && 'rotate-180')}
      />
    </div>
  )
}

function RelayUrls({ urls }: { urls: string[] }) {
  if (!urls) return null

  return (
    <div className="mt-2.5 pt-2.5 border-t space-y-1.5">
      {urls.map((url) => (
        <div key={url} className="flex items-center gap-2.5 pl-1">
          <RelayIcon url={url} className="size-4 shrink-0" classNames={{ fallback: 'size-3' }} />
          <div className="text-muted-foreground text-xs truncate">{url}</div>
        </div>
      ))}
    </div>
  )
}
