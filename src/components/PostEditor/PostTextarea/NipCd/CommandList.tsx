import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { TNipCdCommand } from '@/lib/nip-cd'
import { formatPubkey, generateImageByPubkey, pubkeyToNpub } from '@/lib/pubkey'
import { getSafeExternalUrl } from '@/lib/url'
import { cn } from '@/lib/utils'
import { useContentPolicy } from '@/providers/ContentPolicyProvider'
import { useImperativeHandle, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

export type TCommandListHandle = {
  onKeyDown: (event: KeyboardEvent) => boolean
}

export type TNipCdSuggestionItem = TNipCdCommand & {
  executorName?: string
  executorAvatar?: string
}

export type TCommandListProps = {
  items: TNipCdSuggestionItem[]
  loading: boolean
  command: (item: TNipCdSuggestionItem) => void
  ref: React.Ref<TCommandListHandle>
}

export default function CommandList({ items, loading, command, ref }: TCommandListProps) {
  const { t } = useTranslation()
  const { autoLoadProfilePicture } = useContentPolicy()
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
      className="bg-background pointer-events-auto max-h-64 w-96 max-w-[calc(100vw-3rem)] overflow-y-auto overscroll-contain rounded-md border p-1 shadow-md"
    >
      {items.map((item, position) => (
        <button
          key={`${item.executor}:${item.id}`}
          type="button"
          tabIndex={-1}
          className={cn(
            'block w-full rounded-sm p-2 text-start text-sm',
            index === position && 'bg-accent text-accent-foreground'
          )}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => command(item)}
          onMouseEnter={() => setSelected({ items, index: position })}
        >
          <div className="flex items-center justify-between gap-2">
            <bdi dir="auto" className="min-w-0 truncate font-semibold">
              /{item.command}
            </bdi>
            <span
              className="text-foreground flex max-w-[55%] min-w-0 shrink-0 items-center gap-1.5 text-xs font-semibold"
              title={pubkeyToNpub(item.executor) ?? item.executor}
            >
              <Avatar className="size-4" aria-hidden="true">
                {autoLoadProfilePicture && item.executorAvatar && (
                  <AvatarImage
                    src={getSafeExternalUrl(item.executorAvatar) ?? undefined}
                    alt=""
                    className="object-cover"
                    referrerPolicy="no-referrer"
                  />
                )}
                <AvatarFallback>
                  <img src={generateImageByPubkey(item.executor)} alt="" className="size-full" />
                </AvatarFallback>
              </Avatar>
              <bdi dir="auto" className="min-w-0 truncate">
                {item.executorName ? `@${item.executorName}` : formatPubkey(item.executor)}
              </bdi>
            </span>
          </div>
          <div dir="auto" className="text-muted-foreground truncate text-xs">
            {item.description}
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
