import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createBlossomServerListDraftEvent } from '@/lib/draft-event'
import { extractServersFromTags } from '@/lib/event'
import { useNostr } from '@/providers/NostrProvider'
import client from '@/services/client.service'
import { X } from 'lucide-react'
import { Event } from 'nostr-tools'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

export default function BlossomServerListSetting() {
  const { t } = useTranslation()
  const { pubkey, publish } = useNostr()
  const [blossomServerListEvent, setBlossomServerListEvent] = useState<Event | null>(null)
  const serverUrls = useMemo(() => {
    return extractServersFromTags(blossomServerListEvent ? blossomServerListEvent.tags : [])
  }, [blossomServerListEvent])
  const [url, setUrl] = useState('')

  useEffect(() => {
    const init = async () => {
      if (!pubkey) {
        setBlossomServerListEvent(null)
        return
      }
      const event = await client.fetchBlossomServerListEvent(pubkey)
      setBlossomServerListEvent(event)
    }
    init()
  }, [pubkey])

  const addBlossomUrl = async () => {
    const draftEvent = createBlossomServerListDraftEvent([...serverUrls, url])
    const newEvent = await publish(draftEvent)
    await client.updateBlossomServerListEventCache(newEvent)
    setBlossomServerListEvent(newEvent)
    setUrl('')
  }

  const removeBlossomUrl = async (idx: number) => {
    const draftEvent = createBlossomServerListDraftEvent(serverUrls.filter((_, i) => i !== idx))
    const newEvent = await publish(draftEvent)
    await client.updateBlossomServerListEventCache(newEvent)
    setBlossomServerListEvent(newEvent)
  }

  return (
    <div className="space-y-2">
      <Label>{t('Blossom Service URLs')}</Label>
      {serverUrls.map((url, idx) => (
        <div key={url} className="flex items-center gap-2">
          {url}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => removeBlossomUrl(idx)}
            title={t('Remove')}
          >
            <X />
          </Button>
        </div>
      ))}
      <div className="flex items-center gap-2">
        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder={t('Enter Blossom service URL')}
        />
        <Button type="button" onClick={addBlossomUrl} title={t('Add')}>
          {t('Add')}
        </Button>
      </div>
    </div>
  )
}
