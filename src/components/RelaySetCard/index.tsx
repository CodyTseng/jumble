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
        'group relative w-full rounded-lg border px-3 py-2.5 transition-all duration-200',
        select
          ? 'border-primary bg-primary/5 shadow-xs'
          : 'clickable border-border hover:border-primary/50 hover:bg-accent/50'
      )}
      onClick={() => onSelectChange(!select)}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="flex size-6 shrink-0 items-center justify-center">
            <FolderClosed className="size-5" />
          </div>
          <div className="select-none truncate font-medium">{relaySet.name}</div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
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
      className="flex cursor-pointer items-center gap-0.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
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
    <div className="mt-2.5 space-y-1.5 border-t pt-2.5">
      {urls.map((url) => (
        <div key={url} className="flex items-center gap-2.5 ps-1">
          <RelayIcon url={url} className="size-4 shrink-0" classNames={{ fallback: 'size-3' }} />
          <div className="truncate text-xs text-muted-foreground">{url}</div>
        </div>
      ))}
    </div>
  )
}
