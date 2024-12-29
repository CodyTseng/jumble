import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { extractMentions } from '@/lib/event'
import { useNostr } from '@/providers/NostrProvider'
import { Event } from 'nostr-tools'
import { useEffect, useState } from 'react'
import UserAvatar from '../UserAvatar'
import Username from '../Username'
import { useTranslation } from 'react-i18next'

export default function Mentions({
  content,
  parentEvent
}: {
  content: string
  parentEvent?: Event
}) {
  const { t } = useTranslation()
  const { pubkey } = useNostr()
  const [pubkeys, setPubkeys] = useState<string[]>([])

  useEffect(() => {
    extractMentions(content, parentEvent).then(({ pubkeys }) =>
      setPubkeys(pubkeys.filter((p) => p !== pubkey))
    )
  }, [content, parentEvent, pubkey])

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          className="px-3"
          variant="ghost"
          disabled={pubkeys.length === 0}
          onClick={(e) => e.stopPropagation()}
        >
          {t('Mentions')} {pubkeys.length > 0 && `(${pubkeys.length})`}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-48">
        <div className="space-y-2">
          <div className="text-sm font-semibold">{t('Mentions')}:</div>
          {pubkeys.map((pubkey, index) => (
            <div key={`${pubkey}-${index}`} className="flex gap-1 items-center">
              <UserAvatar userId={pubkey} size="small" />
              <Username
                userId={pubkey}
                className="font-semibold text-sm truncate"
                skeletonClassName="h-3"
              />
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
