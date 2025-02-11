import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Switch } from '@/components/ui/switch'
import { isProtectedEvent } from '@/lib/event'
import { simplifyUrl } from '@/lib/url'
import { useFeed } from '@/providers/FeedProvider'
import { Info } from 'lucide-react'
import { Event } from 'nostr-tools'
import { Dispatch, SetStateAction, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { TPostOptions } from './types'

export default function SendOnlyToSwitch({
  parentEvent,
  postOptions,
  setPostOptions
}: {
  parentEvent?: Event
  postOptions: TPostOptions
  setPostOptions: Dispatch<SetStateAction<TPostOptions>>
}) {
  const { t } = useTranslation()
  const { relayUrls } = useFeed()

  useEffect(() => {
    const isProtected = parentEvent ? isProtectedEvent(parentEvent) : false
    if (isProtected) {
      setPostOptions((prev) => ({ ...prev, sendOnlyToCurrentRelays: true }))
    }
  }, [])

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1">
        <Label htmlFor="send-only-to-current-relays" className="truncate">
          {relayUrls.length === 1
            ? t('Send only to r', { r: simplifyUrl(relayUrls[0]) })
            : t('Send only to current relays')}
        </Label>
        {relayUrls.length > 1 && (
          <Popover>
            <PopoverTrigger>
              <Info size={14} />
            </PopoverTrigger>
            <PopoverContent className="w-fit text-sm">
              {relayUrls.map((url) => (
                <div key={url}>{simplifyUrl(url)}</div>
              ))}
            </PopoverContent>
          </Popover>
        )}
      </div>
      <Switch
        className="shrink-0"
        id="send-only-to-current-relays"
        checked={postOptions.sendOnlyToCurrentRelays}
        onCheckedChange={(checked) =>
          setPostOptions((prev) => ({ ...prev, sendOnlyToCurrentRelays: checked }))
        }
      />
    </div>
  )
}
