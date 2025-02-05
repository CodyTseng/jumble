import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Switch } from '@/components/ui/switch'
import { StorageKey } from '@/constants'
import { simplifyUrl } from '@/lib/url'
import { useFeed } from '@/providers/FeedProvider'
import { Info } from 'lucide-react'
import { Dispatch, SetStateAction, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { TPostOptions } from './types'

export default function PostOptions({
  show,
  postOptions,
  setPostOptions
}: {
  show: boolean
  postOptions: TPostOptions
  setPostOptions: Dispatch<SetStateAction<TPostOptions>>
}) {
  const { t } = useTranslation()
  const { relayUrls } = useFeed()

  useEffect(() => {
    setPostOptions({
      addClientTag: window.localStorage.getItem(StorageKey.ADD_CLIENT_TAG) === 'true',
      sendOnlyToCurrentRelays: false
    })
  }, [])

  if (!show) return null

  const onAddClientTagChange = (checked: boolean) => {
    setPostOptions((prev) => ({ ...prev, addClientTag: checked }))
    window.localStorage.setItem(StorageKey.ADD_CLIENT_TAG, checked.toString())
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center space-x-2">
        <Label htmlFor="add-client-tag">{t('Add client tag')}</Label>
        <Switch
          id="add-client-tag"
          checked={postOptions.addClientTag}
          onCheckedChange={onAddClientTagChange}
        />
      </div>
      <div className="text-muted-foreground text-xs">
        {t('Show others this was sent via Jumble')}
      </div>
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
    </div>
  )
}
