import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { RECOMMENDED_BLOSSOM_SERVERS } from '@/constants'
import { createBlossomServerListDraftEvent } from '@/lib/draft-event'
import { getServersFromServerTags } from '@/lib/tag'
import { normalizeHttpUrl } from '@/lib/url'
import { cn } from '@/lib/utils'
import { useNostr } from '@/providers/NostrProvider'
import client from '@/services/client.service'
import { AlertCircle, ArrowUpToLine, Loader, X } from 'lucide-react'
import { Event } from 'nostr-tools'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

export default function BlossomServerListSetting() {
  const { t } = useTranslation()
  const { pubkey, publish } = useNostr()
  const [blossomServerListEvent, setBlossomServerListEvent] = useState<Event | null>(null)
  const serverUrls = useMemo(() => {
    return getServersFromServerTags(blossomServerListEvent ? blossomServerListEvent.tags : [])
  }, [blossomServerListEvent])
  const [url, setUrl] = useState('')
  const [removingIndex, setRemovingIndex] = useState(-1)
  const [movingIndex, setMovingIndex] = useState(-1)
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

  const addBlossomUrl = async (url: string) => {
    if (!url || adding || removingIndex >= 0 || movingIndex >= 0) return
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
      const normalizedUrl = normalizeHttpUrl(url.trim())
      if (!normalizedUrl) return
      addBlossomUrl(normalizedUrl)
    }
  }

  const removeBlossomUrl = async (idx: number) => {
    if (removingIndex >= 0 || adding || movingIndex >= 0) return
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

  const moveToTop = async (idx: number) => {
    if (removingIndex >= 0 || adding || movingIndex >= 0 || idx === 0) return
    setMovingIndex(idx)
    try {
      const newUrls = [serverUrls[idx], ...serverUrls.filter((_, i) => i !== idx)]
      const draftEvent = createBlossomServerListDraftEvent(newUrls)
      const newEvent = await publish(draftEvent)
      await client.updateBlossomServerListEventCache(newEvent)
      setBlossomServerListEvent(newEvent)
    } catch (error) {
      console.error('Failed to move Blossom URL to top:', error)
    } finally {
      setMovingIndex(-1)
    }
  }

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium">{t('Blossom server URLs')}</div>
      {serverUrls.length === 0 && (
        <div className="flex flex-col gap-1 text-sm border rounded-lg p-2 bg-muted text-muted-foreground">
          <div className="font-medium flex gap-2 items-center">
            <AlertCircle className="size-4" />
            {t('You need to add at least one media server in order to upload media files.')}
          </div>
          <Separator className="bg-muted-foreground my-2" />
          <div className="font-medium">{t('Recommended blossom servers')}:</div>
          <div className="flex flex-col">
            {RECOMMENDED_BLOSSOM_SERVERS.map((recommendedUrl) => (
              <Button
                variant="link"
                key={recommendedUrl}
                onClick={() => addBlossomUrl(recommendedUrl)}
                disabled={removingIndex >= 0 || adding || movingIndex >= 0}
                className="w-fit p-0 text-muted-foreground hover:text-foreground h-fit"
              >
                {recommendedUrl}
              </Button>
            ))}
          </div>
        </div>
      )}
      {serverUrls.map((url, idx) => (
        <div
          key={url}
          className={cn(
            'flex items-center justify-between gap-2 pl-3 pr-1 py-1 border rounded-lg',
            idx === 0 && 'border-primary'
          )}
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
            {idx > 0 ? (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => moveToTop(idx)}
                title={t('Move to top')}
                disabled={removingIndex >= 0 || adding || movingIndex >= 0}
                className="text-muted-foreground"
              >
                {movingIndex === idx ? <Loader className="animate-spin" /> : <ArrowUpToLine />}
              </Button>
            ) : (
              <Badge>{t('Preferred')}</Badge>
            )}
            <Button
              variant="ghost-destructive"
              size="icon"
              onClick={() => removeBlossomUrl(idx)}
              title={t('Remove')}
              disabled={removingIndex >= 0 || adding || movingIndex >= 0}
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
          placeholder={t('Enter Blossom server URL')}
          onKeyDown={handleUrlInputKeyDown}
        />
        <Button
          type="button"
          onClick={() => {
            const normalizedUrl = normalizeHttpUrl(url.trim())
            if (!normalizedUrl) return
            addBlossomUrl(normalizedUrl)
          }}
          title={t('Add')}
        >
          {adding && <Loader className="animate-spin" />}
          {t('Add')}
        </Button>
      </div>
    </div>
  )
}
