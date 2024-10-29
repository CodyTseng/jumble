import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { X } from 'lucide-react'
import { useState } from 'react'

export default function RelayUrls({
  isActive,
  relayUrls,
  update
}: {
  isActive: boolean
  relayUrls: string[]
  update: (urls: string[]) => void
}) {
  const [newRelayUrl, setNewRelayUrl] = useState('')
  const [newRelayUrlError, setNewRelayUrlError] = useState<string | null>(null)

  const removeRelayUrl = (url: string) => {
    update(relayUrls.filter((u) => u !== url))
  }

  const saveNewRelayUrl = () => {
    const newRelayUrls = Array.from(
      new Set([...relayUrls, newRelayUrl].map((url) => url.trim()).filter((url) => url !== ''))
    )
    for (const url of newRelayUrls) {
      if (/^wss?:\/\/.+$/.test(url) === false) {
        return setNewRelayUrlError('invalid URL')
      }
    }
    update(newRelayUrls)
    setNewRelayUrl('')
  }

  const handleRelayUrlInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewRelayUrl(e.target.value)
    setNewRelayUrlError(null)
  }

  const handleRelayUrlInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      saveNewRelayUrl()
    }
  }

  return (
    <>
      <div className="mt-1">
        {relayUrls.map((url) => (
          <RelayUrl key={url} url={url} onRemove={() => removeRelayUrl(url)} />
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        <Input
          className={`h-8 ${isActive ? 'focus-visible:ring-highlight' : ''} ${newRelayUrlError ? 'border-destructive' : ''}`}
          placeholder="Add new relay URL"
          value={newRelayUrl}
          onKeyDown={handleRelayUrlInputKeyDown}
          onChange={handleRelayUrlInputChange}
          onBlur={saveNewRelayUrl}
        />
        <Button
          className={`h-8 w-12 ${isActive ? 'bg-highlight hover:bg-highlight/90' : ''}`}
          onClick={saveNewRelayUrl}
        >
          Add
        </Button>
      </div>
      {newRelayUrlError && <div className="text-xs text-destructive mt-1">{newRelayUrlError}</div>}
    </>
  )
}

function RelayUrl({ url, onRemove }: { url: string; onRemove: () => void }) {
  return (
    <div className="flex items-center justify-between">
      <div className="text-muted-foreground text-sm">{url}</div>
      <div>
        <Button
          size="xs"
          variant="ghost"
          className="text-xs text-destructive hover:bg-destructive/90 hover:text-background"
          onClick={onRemove}
        >
          <X size={12} />
        </Button>
      </div>
    </div>
  )
}
