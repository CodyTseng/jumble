import RelayIcon from '@/components/RelayIcon'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DEFAULT_DM_RELAYS } from '@/constants'
import { normalizeUrl } from '@/lib/url'
import { useNostr } from '@/providers/NostrProvider'
import client from '@/services/client.service'
import { CircleX, Plus } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { createDmRelaysDraftEvent } from '@/lib/draft-event'

export default function DmRelayConfig({ onComplete }: { onComplete?: () => void }) {
  const { t } = useTranslation()
  const { pubkey, publish } = useNostr()
  const [relays, setRelays] = useState<string[]>([])
  const [newRelay, setNewRelay] = useState('')
  const [newRelayError, setNewRelayError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const autoSave = !onComplete
  const relaysRef = useRef(relays)
  relaysRef.current = relays

  useEffect(() => {
    if (!pubkey) return

    const loadRelays = async () => {
      setIsLoading(true)
      try {
        const userRelays = await client.fetchDmRelays(pubkey)
        setRelays(userRelays)
      } catch {
        setRelays([...DEFAULT_DM_RELAYS])
      } finally {
        setIsLoading(false)
      }
    }

    loadRelays()
  }, [pubkey])

  const publishRelays = useCallback(
    async (newRelays: string[]) => {
      try {
        await publish(createDmRelaysDraftEvent(newRelays))
      } catch {
        toast.error(t('Failed to save DM relays'))
      }
    },
    [publish, t]
  )

  const handleAddRelay = () => {
    if (!newRelay) return
    const normalized = normalizeUrl(newRelay)
    if (!normalized) {
      setNewRelayError(t('Invalid relay URL'))
      return
    }
    if (relays.includes(normalized)) {
      setNewRelayError(t('Relay already exists'))
      return
    }
    const newRelays = [...relays, normalized]
    setRelays(newRelays)
    setNewRelay('')
    setNewRelayError(null)
    if (autoSave) publishRelays(newRelays)
  }

  const handleRemoveRelay = (url: string) => {
    const newRelays = relays.filter((r) => r !== url)
    setRelays(newRelays)
    if (autoSave) publishRelays(newRelays)
  }

  const handleAddDefault = (url: string) => {
    if (!relays.includes(url)) {
      const newRelays = [...relays, url]
      setRelays(newRelays)
      if (autoSave) publishRelays(newRelays)
    }
  }

  const handleSave = async () => {
    if (relays.length === 0) {
      toast.error(t('Please add at least one relay'))
      return
    }

    setIsSaving(true)
    try {
      await publish(createDmRelaysDraftEvent(relays))
      toast.success(t('DM relays saved'))
      onComplete?.()
    } catch {
      toast.error(t('Failed to save DM relays'))
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-4 p-4">
      <div>
        <h3 className="text-lg font-semibold mb-2">{t('Configure DM Relays')}</h3>
        <p className="text-sm text-muted-foreground">
          {t(
            'Select relays to use for direct messages. These relays will receive your encrypted messages.'
          )}
        </p>
      </div>

      <div className="space-y-2">
        <div className="text-sm font-medium">{t('Your DM Relays')}</div>
        {relays.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('No relays configured')}</p>
        ) : (
          <div>
            {relays.map((relay) => (
              <div key={relay} className="flex items-center justify-between py-1 pl-1 pr-3">
                <div className="flex w-0 flex-1 items-center gap-3">
                  <RelayIcon url={relay} className="h-4 w-4" />
                  <div className="truncate text-sm text-muted-foreground">{relay}</div>
                </div>
                <div className="shrink-0">
                  <CircleX
                    size={16}
                    onClick={() => handleRemoveRelay(relay)}
                    className="cursor-pointer text-muted-foreground hover:text-destructive"
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <div className="flex gap-2">
          <Input
            className={newRelayError ? 'border-destructive' : ''}
            placeholder="wss://..."
            value={newRelay}
            onChange={(e) => {
              setNewRelay(e.target.value)
              setNewRelayError(null)
            }}
            onKeyDown={(e) => e.key === 'Enter' && handleAddRelay()}
          />
          <Button onClick={handleAddRelay}>{t('Add')}</Button>
        </div>
        {newRelayError && <div className="mt-1 text-xs text-destructive">{newRelayError}</div>}
      </div>

      {DEFAULT_DM_RELAYS.filter((r) => !relays.includes(r)).length > 0 && (
        <div className="space-y-2">
          <div className="text-sm font-medium">{t('Suggested Relays')}</div>
          <div className="flex flex-wrap gap-2">
            {DEFAULT_DM_RELAYS.filter((r) => !relays.includes(r)).map((relay) => (
              <Button
                key={relay}
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => handleAddDefault(relay)}
              >
                <Plus className="h-3 w-3 mr-1" />
                {relay.replace('wss://', '').replace('/', '')}
              </Button>
            ))}
          </div>
        </div>
      )}

      {!autoSave && (
        <Button className="w-full" onClick={handleSave} disabled={isSaving || relays.length === 0}>
          {isSaving ? t('Saving...') : t('Save and Continue')}
        </Button>
      )}
    </div>
  )
}
