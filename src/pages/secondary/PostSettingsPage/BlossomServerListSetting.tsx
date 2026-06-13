import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SettingsRow } from '@/components/ui/settings'
import { RECOMMENDED_BLOSSOM_SERVERS } from '@/constants'
import { createBlossomServerListDraftEvent } from '@/lib/draft-event'
import { formatError } from '@/lib/error'
import { getServersFromServerTags } from '@/lib/tag'
import { normalizeHttpUrl, simplifyUrl } from '@/lib/url'
import { useNostr } from '@/providers/NostrProvider'
import client from '@/services/client.service'
import { AlertCircle, ArrowUpToLine, Loader, Plus, Server, X } from 'lucide-react'
import { Event } from 'nostr-tools'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

export default function BlossomServerListSetting() {
  const { t } = useTranslation()
  const { pubkey, publish } = useNostr()
  const [blossomServerListEvent, setBlossomServerListEvent] = useState<Event | null>(null)
  const [loading, setLoading] = useState(true)
  const [url, setUrl] = useState('')
  const [removingIndex, setRemovingIndex] = useState(-1)
  const [movingIndex, setMovingIndex] = useState(-1)
  const [adding, setAdding] = useState(false)

  const serverUrls = useMemo(() => {
    return getServersFromServerTags(blossomServerListEvent ? blossomServerListEvent.tags : [])
  }, [blossomServerListEvent])
  const recommendedServers = useMemo(
    () => RECOMMENDED_BLOSSOM_SERVERS.filter((url) => !serverUrls.includes(normalizeHttpUrl(url))),
    [serverUrls]
  )
  const busy = adding || removingIndex >= 0 || movingIndex >= 0

  useEffect(() => {
    const init = async () => {
      if (!pubkey) {
        setBlossomServerListEvent(null)
        setLoading(false)
        return
      }
      setLoading(true)
      const event = await client.fetchBlossomServerListEvent(pubkey)
      setBlossomServerListEvent(event)
      setLoading(false)
    }
    init()
  }, [pubkey])

  const updateServerList = async (newUrls: string[]) => {
    const draftEvent = createBlossomServerListDraftEvent(newUrls)
    const newEvent = await publish(draftEvent)
    await client.updateBlossomServerListEventCache(newEvent)
    setBlossomServerListEvent(newEvent)
  }

  const addBlossomUrl = async (target: string) => {
    if (!target || busy || serverUrls.includes(normalizeHttpUrl(target))) return
    setAdding(true)
    try {
      await updateServerList([...serverUrls, target])
      setUrl('')
    } catch (error) {
      formatError(error).forEach((err) => {
        toast.error(`${t('Failed to add Blossom URL')}: ${err}`, { duration: 10_000 })
      })
    } finally {
      setAdding(false)
    }
  }

  const handleAddFromInput = () => {
    const normalizedUrl = normalizeHttpUrl(url.trim())
    if (!normalizedUrl) return
    addBlossomUrl(normalizedUrl)
  }

  const removeBlossomUrl = async (idx: number) => {
    if (busy) return
    setRemovingIndex(idx)
    try {
      await updateServerList(serverUrls.filter((_, i) => i !== idx))
    } catch (error) {
      formatError(error).forEach((err) => {
        toast.error(`${t('Failed to remove Blossom URL')}: ${err}`, { duration: 10_000 })
      })
    } finally {
      setRemovingIndex(-1)
    }
  }

  const moveToTop = async (idx: number) => {
    if (busy || idx === 0) return
    setMovingIndex(idx)
    try {
      await updateServerList([serverUrls[idx], ...serverUrls.filter((_, i) => i !== idx)])
    } catch (error) {
      formatError(error).forEach((err) => {
        toast.error(`${t('Failed to move Blossom URL to top')}: ${err}`, { duration: 10_000 })
      })
    } finally {
      setMovingIndex(-1)
    }
  }

  if (loading) {
    return (
      <SettingsRow title={<Loader className="size-4 animate-spin text-muted-foreground" />} />
    )
  }

  return (
    <>
      {serverUrls.map((serverUrl, idx) => (
        <SettingsRow
          key={serverUrl}
          icon={<Server />}
          title={<span className="block truncate">{simplifyUrl(serverUrl)}</span>}
          control={
            <>
              {idx === 0 ? (
                <Badge variant="secondary">{t('Preferred')}</Badge>
              ) : (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => moveToTop(idx)}
                  title={t('Move to top')}
                  disabled={busy}
                  className="text-muted-foreground"
                >
                  {movingIndex === idx ? <Loader className="animate-spin" /> : <ArrowUpToLine />}
                </Button>
              )}
              <Button
                variant="ghost-destructive"
                size="icon"
                onClick={() => removeBlossomUrl(idx)}
                title={t('Remove')}
                disabled={busy}
              >
                {removingIndex === idx ? <Loader className="animate-spin" /> : <X />}
              </Button>
            </>
          }
        />
      ))}

      <SettingsRow layout="stacked" title={t('Add Blossom server')}>
        <div className="space-y-3">
          <div className="flex gap-2">
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={t('Enter Blossom server URL')}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleAddFromInput()
                }
              }}
              className="flex-1"
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={handleAddFromInput}
              disabled={busy || !url.trim()}
              title={t('Add')}
            >
              {adding ? <Loader className="animate-spin" /> : <Plus />}
            </Button>
          </div>

          {serverUrls.length === 0 && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <AlertCircle className="size-4 shrink-0" />
              {t('You need to add at least one media server in order to upload media files.')}
            </div>
          )}

          {recommendedServers.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-xs font-medium text-muted-foreground">
                {t('Recommended blossom servers')}
              </div>
              <div className="flex flex-wrap gap-2">
                {recommendedServers.map((recommendedUrl) => (
                  <button
                    key={recommendedUrl}
                    type="button"
                    onClick={() => addBlossomUrl(recommendedUrl)}
                    disabled={busy}
                    className="clickable flex items-center gap-1 rounded-full border px-2.5 py-1 text-sm text-muted-foreground hover:text-foreground disabled:opacity-50"
                  >
                    <Plus className="size-3.5" />
                    {simplifyUrl(recommendedUrl)}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </SettingsRow>
    </>
  )
}
