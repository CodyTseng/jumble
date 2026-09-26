import { useSecondaryPage } from '@/PageManager'
import { toRelay } from '@/lib/link'

export function EmbeddedWebsocketUrl({ url }: { url: string }) {
  const { push } = useSecondaryPage()
  const openRelay = () => push(toRelay(url))

  return (
    <span
      role="button"
      tabIndex={0}
      className="text-primary hover:bg-primary/20 cursor-pointer px-1"
      onClick={openRelay}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          openRelay()
        }
      }}
    >
      [ {url} ]
      <span className="bg-primary h-1 w-2" />
    </span>
  )
}
