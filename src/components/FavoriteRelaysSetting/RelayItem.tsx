import { useState } from 'react'
import RelayIcon from '../RelayIcon'
import { Check, Copy, Trash2 } from 'lucide-react'
import { Button } from '../ui/button'
import { useFavoriteRelays } from '@/providers/FavoriteRelaysProvider'

export default function RelayItem({ relay }: { relay: string }) {
  const { deleteFavoriteRelays } = useFavoriteRelays()
  const [copied, setCopied] = useState(false)

  return (
    <div className="flex gap-2 border rounded-lg px-4 py-3">
      <RelayIcon url={relay} />
      <div className="flex-1 w-0 truncate">{relay}</div>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => {
          navigator.clipboard.writeText(relay)
          setCopied(true)
          setTimeout(() => {
            setCopied(false)
          }, 2000)
        }}
      >
        {copied ? <Check /> : <Copy />}
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="hover:text-destructive"
        onClick={() => {
          deleteFavoriteRelays([relay])
        }}
      >
        <Trash2 />
      </Button>
    </div>
  )
}
