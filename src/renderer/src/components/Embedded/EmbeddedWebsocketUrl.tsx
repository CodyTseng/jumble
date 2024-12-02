import { useSecondaryPage } from '@renderer/PageManager'
import { toNoteList } from '@renderer/lib/link'
import { TEmbeddedRenderer } from './types'

export function EmbeddedWebsocketUrl({ url }: { url: string }) {
  const { push } = useSecondaryPage()
  return (
    <span
      className="cursor-pointer px-1 rounded-md text-highlight border border-highlight/60 hover:border-highlight hover:bg-muted/60"
      onClick={(e) => {
        e.stopPropagation()
        push(toNoteList({ relay: url }))
      }}
    >
      {url}
    </span>
  )
}

export const embeddedWebsocketUrlRenderer: TEmbeddedRenderer = {
  regex: /(wss?:\/\/[^\s]+)/g,
  render: (url: string, index: number) => {
    return <EmbeddedWebsocketUrl key={`websocket-url-${index}-${url}`} url={url} />
  }
}
