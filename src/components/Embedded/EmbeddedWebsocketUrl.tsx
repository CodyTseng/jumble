import { useSecondaryPage } from '@/PageManager'
import { toNoteList } from '@/lib/link'
import { TEmbeddedRenderer } from './types'

export function EmbeddedWebsocketUrl({ url }: { url: string }) {
  const { push } = useSecondaryPage()
  return (
    <span
      className="cursor-pointer px-1 text-highlight hover:bg-highlight/20"
      onClick={(e) => {
        e.stopPropagation()
        push(toNoteList({ relay: url }))
      }}
    >
      [ {url} ]
      <span className="w-2 h-1 bg-highlight" />
    </span>
  )
}

export const embeddedWebsocketUrlRenderer: TEmbeddedRenderer = {
  regex: /(wss?:\/\/[^\s]+)/g,
  render: (url: string, index: number) => {
    return <EmbeddedWebsocketUrl key={`websocket-url-${index}-${url}`} url={url} />
  }
}
