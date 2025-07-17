import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createBlossomServerListDraftEvent } from '@/lib/draft-event'
import { extractServersFromTags } from '@/lib/event'
import { useNostr } from '@/providers/NostrProvider'
import client from '@/services/client.service'
import { Loader, X } from 'lucide-react'
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
  const [removingIndex, setRemovingIndex] = useState(-1)
  const [adding, setAdding] = useState(false)

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
    if (!url || adding) return
    setAdding(true)
    try {
      const draftEvent = createBlossomServerListDraftEvent([...serverUrls, url])
      const newEvent = await publish(draftEvent)
      await client.updateBlossomServerListEventCache(newEvent)
      setBlossomServerListEvent(newEvent)
      setUrl('')
    } catch (error) {
      console.error('Failed to add Blossom URL:', error)
    } finally {
      setAdding(false)
    }
  }

  const handleUrlInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      addBlossomUrl()
    }
  }

  const removeBlossomUrl = async (idx: number) => {
    if (removingIndex >= 0 || adding) return
    setRemovingIndex(idx)
    try {
      const draftEvent = createBlossomServerListDraftEvent(serverUrls.filter((_, i) => i !== idx))
      const newEvent = await publish(draftEvent)
      await client.updateBlossomServerListEventCache(newEvent)
      setBlossomServerListEvent(newEvent)
    } catch (error) {
      console.error('Failed to remove Blossom URL:', error)
    } finally {
      setRemovingIndex(-1)
    }
  }

  return (
    <div className="space-y-2">
      <Label>{t('Blossom Service URLs')}</Label>
      {serverUrls.map((url, idx) => (
        <div
          key={url}
          className="flex items-center justify-between gap-2 pl-3 pr-1 py-1 border rounded-lg"
        >
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="truncate hover:underline"
          >
            {url}
          </a>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost-destructive"
              size="icon"
              onClick={() => removeBlossomUrl(idx)}
              title={t('Remove')}
              disabled={removingIndex >= 0 || adding}
            >
              {removingIndex === idx ? <Loader className="animate-spin" /> : <X />}
            </Button>
          </div>
        </div>
      ))}
      <div className="flex items-center gap-2">
        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder={t('Enter Blossom service URL')}
          onKeyDown={handleUrlInputKeyDown}
        />
        <Button type="button" onClick={addBlossomUrl} title={t('Add')}>
          {adding && <Loader className="animate-spin" />}
          {t('Add')}
        </Button>
      </div>
    </div>
  )
}
