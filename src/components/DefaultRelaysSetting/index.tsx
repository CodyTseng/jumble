import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { BIG_RELAY_URLS } from '@/constants'
import { isWebsocketUrl, normalizeUrl } from '@/lib/url'
import storage from '@/services/local-storage.service'
import { CircleX } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import InfoCard from '../InfoCard'
import RelayIcon from '../RelayIcon'

export default function DefaultRelaysSetting() {
  const { t } = useTranslation()
  const [relayUrls, setRelayUrls] = useState<string[]>(storage.getDefaultRelayUrls())
  const [newRelayUrl, setNewRelayUrl] = useState('')
  const [newRelayUrlError, setNewRelayUrlError] = useState<string | null>(null)

  const removeRelayUrl = (url: string) => {
    const normalizedUrl = normalizeUrl(url)
    if (!normalizedUrl) return
    const newUrls = relayUrls.filter((u) => u !== normalizedUrl)
    setRelayUrls(newUrls)
    storage.setDefaultRelayUrls(newUrls)
  }

  const saveNewRelayUrl = () => {
    if (newRelayUrl === '') return
    const normalizedUrl = normalizeUrl(newRelayUrl)
    if (!normalizedUrl) {
      return setNewRelayUrlError(t('Invalid relay URL'))
    }
    if (relayUrls.includes(normalizedUrl)) {
      return setNewRelayUrlError(t('Relay already exists'))
    }
    if (!isWebsocketUrl(normalizedUrl)) {
      return setNewRelayUrlError(t('invalid relay URL'))
    }
    const newUrls = [...relayUrls, normalizedUrl]
    setRelayUrls(newUrls)
    storage.setDefaultRelayUrls(newUrls)
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

  const resetToDefault = () => {
    setRelayUrls(BIG_RELAY_URLS)
    storage.setDefaultRelayUrls(BIG_RELAY_URLS)
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-base font-normal">{t('Default relays')}</Label>
        <Button variant="outline" size="sm" onClick={resetToDefault}>
          {t('Reset to default')}
        </Button>
      </div>
      <div className="text-xs text-muted-foreground">{t('Default relays description')}</div>
      <InfoCard variant="alert" title={t('Default relays warning')} />
      <div className="mt-1">
        {relayUrls.map((url, index) => (
          <RelayUrl key={index} url={url} onRemove={() => removeRelayUrl(url)} />
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        <Input
          className={newRelayUrlError ? 'border-destructive' : ''}
          placeholder={t('Add a new relay')}
          value={newRelayUrl}
          onKeyDown={handleRelayUrlInputKeyDown}
          onChange={handleRelayUrlInputChange}
          onBlur={saveNewRelayUrl}
        />
        <Button onClick={saveNewRelayUrl}>{t('Add')}</Button>
      </div>
      {newRelayUrlError && <div className="text-xs text-destructive mt-1">{newRelayUrlError}</div>}
    </div>
  )
}

function RelayUrl({ url, onRemove }: { url: string; onRemove: () => void }) {
  return (
    <div className="flex items-center justify-between pl-1 pr-3 py-1">
      <div className="flex gap-3 items-center flex-1 w-0">
        <RelayIcon url={url} className="w-4 h-4" />
        <div className="text-muted-foreground text-sm truncate">{url}</div>
      </div>
      <div className="shrink-0">
        <CircleX
          size={16}
          onClick={onRemove}
          className="text-muted-foreground hover:text-destructive cursor-pointer"
        />
      </div>
    </div>
  )
}
