import { Button } from '@renderer/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@renderer/components/ui/popover'
import { extractMentions } from '@renderer/lib/event'
import { useEffect, useState } from 'react'
import UserAvatar from '../UserAvatar'
import Username from '../Username'
import { Event } from 'nostr-tools'

export default function Mentions({
  content,
  parentEvent
}: {
  content: string
  parentEvent?: Event
}) {
  const [pubkeys, setPubkeys] = useState<string[]>([])

  useEffect(() => {
    extractMentions(content, parentEvent).then(({ pubkeys }) => setPubkeys(pubkeys))
  }, [content])

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          className="px-3"
          variant="ghost"
          disabled={pubkeys.length === 0}
          onClick={(e) => e.stopPropagation()}
        >
          Mentions {pubkeys.length > 0 && `(${pubkeys.length})`}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-48">
        <div className="space-y-2">
          <div className="text-sm font-semibold">Mentions:</div>
          {pubkeys.map((pubkey, index) => (
            <div key={`${pubkey}-${index}`} className="flex gap-1 items-center">
              <UserAvatar userId={pubkey} size="small" />
              <Username userId={pubkey} className="font-semibold text-sm truncate" />
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
