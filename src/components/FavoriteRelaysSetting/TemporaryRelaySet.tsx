import { useFeed } from '@/providers/FeedProvider'
import RelayIcon from '../RelayIcon'
import SaveRelayDropdownMenu from '../SaveRelayDropdownMenu'

export default function TemporaryRelaySet() {
  const { temporaryRelayUrls } = useFeed()

  if (!temporaryRelayUrls.length) {
    return null
  }

  return (
    <div className="w-full border border-dashed rounded-lg p-4 border-primary bg-primary/5 flex gap-4 justify-between">
      <div className="flex-1 w-0">
        <div className="flex justify-between items-center">
          <div className="h-8 font-semibold">Temporary</div>
        </div>
        {temporaryRelayUrls.map((url) => (
          <div className="flex gap-3 items-center">
            <RelayIcon url={url} className="w-4 h-4" iconSize={10} />
            <div className="text-muted-foreground text-sm truncate">{url}</div>
          </div>
        ))}
      </div>
      <SaveRelayDropdownMenu urls={temporaryRelayUrls} />
    </div>
  )
}
