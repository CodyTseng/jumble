import { TNipCdCommand } from '@/lib/nip-cd'
import { formatPubkey, pubkeyToNpub } from '@/lib/pubkey'
import { cn } from '@/lib/utils'
import { useImperativeHandle, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

export type TCommandListHandle = {
  onKeyDown: (event: KeyboardEvent) => boolean
}

export type TNipCdSuggestionItem = TNipCdCommand & { executorName?: string }

export type TCommandListProps = {
  items: TNipCdSuggestionItem[]
  loading: boolean
  command: (item: TNipCdSuggestionItem) => void
  ref: React.Ref<TCommandListHandle>
}

export default function CommandList({ items, loading, command, ref }: TCommandListProps) {
  const { t } = useTranslation()
  const [selected, setSelected] = useState<{ items: TNipCdSuggestionItem[]; index: number }>()
  const listRef = useRef<HTMLDivElement>(null)
  const index = selected?.items === items ? selected.index : 0

  useImperativeHandle(ref, () => ({
    onKeyDown(event) {
      if (!items.length || event.isComposing || event.keyCode === 229) return false
      if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
        const delta = event.key === 'ArrowUp' ? -1 : 1
        const next = (index + items.length + delta) % items.length
        setSelected({ items, index: next })
        listRef.current?.children[next]?.scrollIntoView?.({ block: 'nearest' })
        return true
      }
      if (
        event.key === 'Enter' &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.shiftKey &&
        !event.altKey
      ) {
        command(items[index])
        return true
      }
      return false
    }
  }))

  return (
    <div
      ref={listRef}
      className="bg-background pointer-events-auto max-h-64 w-80 max-w-[calc(100vw-3rem)] overflow-y-auto overscroll-contain rounded-lg border p-1 shadow-md"
    >
      {items.map((item, position) => (
        <button
          key={`${item.executor}:${item.id}`}
          type="button"
          tabIndex={-1}
          className={cn(
            'block w-full rounded-md p-2 text-start text-sm',
            index === position && 'bg-accent text-accent-foreground'
          )}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => command(item)}
          onMouseEnter={() => setSelected({ items, index: position })}
        >
          <div dir="auto" className="truncate font-semibold">
            <bdi>/{item.command}</bdi>
            {item.args.map(({ name, label, required }) => (
              <bdi key={name} className="text-muted-foreground ms-1 font-normal">
                {required ? `<${label}>` : `[${label}]`}
              </bdi>
            ))}
          </div>
          <div
            dir="auto"
            className="text-muted-foreground truncate text-xs"
            title={pubkeyToNpub(item.executor) ?? item.executor}
          >
            {item.executorName ? `@${item.executorName} · ` : ''}
            {formatPubkey(item.executor)}
          </div>
          <div dir="auto" className="text-muted-foreground truncate text-xs">
            {item.title === item.command ? item.description : `${item.title}: ${item.description}`}
          </div>
        </button>
      ))}
      {loading && (
        <div role="status" className="text-muted-foreground px-2 py-1.5 text-sm">
          {t('Loading...')}
        </div>
      )}
    </div>
  )
}
