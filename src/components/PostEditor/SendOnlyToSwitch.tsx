import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Switch } from '@/components/ui/switch'
import { isProtectedEvent } from '@/lib/event'
import { simplifyUrl } from '@/lib/url'
import { useFeed } from '@/providers/FeedProvider'
import client from '@/services/client.service'
import { Info } from 'lucide-react'
import { Event } from 'nostr-tools'
import { Dispatch, SetStateAction, useMemo } from 'react'
import { useTranslation } from 'react-i18next'

export default function SendOnlyToSwitch({
  parentEvent,
  specifiedRelayUrls,
  setSpecifiedRelayUrls
}: {
  parentEvent?: Event
  specifiedRelayUrls?: string[]
  setSpecifiedRelayUrls: Dispatch<SetStateAction<string[] | undefined>>
}) {
  const { t } = useTranslation()
  const { relayUrls } = useFeed()
  const urls = useMemo(() => {
    if (!parentEvent) return relayUrls
    const isProtected = isProtectedEvent(parentEvent)
    const seenOn = client.getSeenEventRelayUrls(parentEvent.id)
    if (isProtected && seenOn.length) {
      setSpecifiedRelayUrls(seenOn)
      return seenOn
    }
    return relayUrls
  }, [parentEvent, relayUrls])

  if (!urls.length) return null

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1">
        <Label htmlFor="send-only-to-current-relays" className="truncate">
          {urls.length === 1
            ? t('Send only to r', { r: simplifyUrl(urls[0]) })
            : t('Send only to these relays')}
        </Label>
        {urls.length > 1 && (
          <Popover>
            <PopoverTrigger>
              <Info size={14} />
            </PopoverTrigger>
            <PopoverContent className="w-fit text-sm">
              {urls.map((url) => (
                <div key={url}>{simplifyUrl(url)}</div>
              ))}
            </PopoverContent>
          </Popover>
        )}
      </div>
      <Switch
        className="shrink-0"
        id="send-only-to-current-relays"
        checked={!!specifiedRelayUrls}
        onCheckedChange={(checked) => setSpecifiedRelayUrls(checked ? urls : undefined)}
      />
    </div>
  )
}
