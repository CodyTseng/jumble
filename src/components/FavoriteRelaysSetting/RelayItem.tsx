import { toRelay } from '@/lib/link'
import { useSecondaryPage } from '@/PageManager'
import RelayIcon from '../RelayIcon'
import SaveRelayDropdownMenu from '../SaveRelayDropdownMenu'

export default function RelayItem({ relay }: { relay: string }) {
  const { push } = useSecondaryPage()

  return (
    <div
      className="flex gap-2 border rounded-lg px-4 py-3 items-center clickable select-none"
      onClick={() => push(toRelay(relay))}
    >
      <RelayIcon url={relay} />
      <div className="flex-1 w-0 truncate font-semibold">{relay}</div>
      <SaveRelayDropdownMenu urls={[relay]} />
    </div>
  )
}
