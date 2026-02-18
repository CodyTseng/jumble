import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DEFAULT_DM_RELAYS } from '@/constants'
import { normalizeUrl } from '@/lib/url'
import { useNostr } from '@/providers/NostrProvider'
import client from '@/services/client.service'
import { Plus, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { createDmRelaysDraftEvent } from '@/lib/draft-event'

export default function DmRelayConfig({ onComplete }: { onComplete?: () => void }) {
  const { t } = useTranslation()
  const { pubkey, publish } = useNostr()
  const [relays, setRelays] = useState<string[]>([])
  const [newRelay, setNewRelay] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

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

  const handleAddRelay = () => {
    const normalized = normalizeUrl(newRelay)
    if (!normalized) {
      toast.error(t('Invalid relay URL'))
      return
    }
    if (relays.includes(normalized)) {
      toast.error(t('Relay already added'))
      return
    }
    setRelays([...relays, normalized])
    setNewRelay('')
  }

  const handleRemoveRelay = (url: string) => {
    setRelays(relays.filter((r) => r !== url))
  }

  const handleAddDefault = (url: string) => {
    if (!relays.includes(url)) {
      setRelays([...relays, url])
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
        <p className="text-sm text-muted-foreground mb-4">
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
          <div className="space-y-2">
            {relays.map((relay) => (
              <div
                key={relay}
                className="flex items-center justify-between gap-2 p-2 bg-secondary rounded-lg"
              >
                <span className="text-sm truncate">{relay}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => handleRemoveRelay(relay)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <Input
          placeholder={t('wss://relay.example.com')}
          value={newRelay}
          onChange={(e) => setNewRelay(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAddRelay()}
        />
        <Button variant="secondary" size="icon" onClick={handleAddRelay}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>

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

      <Button className="w-full" onClick={handleSave} disabled={isSaving || relays.length === 0}>
        {isSaving ? t('Saving...') : t('Save and Continue')}
      </Button>
    </div>
  )
}
