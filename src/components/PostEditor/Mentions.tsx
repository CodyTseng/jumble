import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { extractMentions } from '@/lib/event'
import { useNostr } from '@/providers/NostrProvider'
import { Event } from 'nostr-tools'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { SimpleUserAvatar } from '../UserAvatar'
import { SimpleUsername } from '../Username'

export default function Mentions({
  content,
  mentions,
  setMentions,
  parentEvent
}: {
  content: string
  mentions: string[]
  setMentions: (mentions: string[]) => void
  parentEvent?: Event
}) {
  const { t } = useTranslation()
  const { pubkey } = useNostr()
  const [pubkeys, setPubkeys] = useState<string[]>([])
  const [relatedPubkeys, setRelatedPubkeys] = useState<string[]>([])
  const [parentEventPubkey, setParentEventPubkey] = useState<string | undefined>()
  const [addedPubkeys, setAddedPubkeys] = useState<string[]>([])
  const [removedPubkeys, setRemovedPubkeys] = useState<string[]>([])

  useEffect(() => {
    extractMentions(content, parentEvent).then(({ pubkeys, relatedPubkeys, parentEventPubkey }) => {
      setPubkeys(pubkeys.filter((p) => p !== pubkey))
      setRelatedPubkeys(relatedPubkeys.filter((p) => p !== pubkey))
      setParentEventPubkey(parentEventPubkey !== pubkey ? parentEventPubkey : undefined)
      const potentialMentions = [...pubkeys, ...relatedPubkeys]
      setAddedPubkeys((pubkeys) => {
        return pubkeys.filter((p) => potentialMentions.includes(p))
      })
      setRemovedPubkeys((pubkeys) => {
        return pubkeys.filter((p) => potentialMentions.includes(p))
      })
    })
  }, [content, parentEvent, pubkey])

  useEffect(() => {
    const newMentions = [...pubkeys]
    addedPubkeys.forEach((pubkey) => {
      if (!newMentions.includes(pubkey) && pubkey !== parentEventPubkey) {
        newMentions.push(pubkey)
      }
    })
    removedPubkeys.forEach((pubkey) => {
      const index = newMentions.indexOf(pubkey)
      if (index !== -1) {
        newMentions.splice(index, 1)
      }
    })
    if (parentEventPubkey) {
      newMentions.push(parentEventPubkey)
    }
    setMentions(newMentions)
  }, [pubkeys, relatedPubkeys, parentEventPubkey, addedPubkeys, removedPubkeys])

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          className="px-3"
          variant="ghost"
          disabled={pubkeys.length === 0 && relatedPubkeys.length === 0 && !parentEventPubkey}
          onClick={(e) => e.stopPropagation()}
        >
          {t('Mentions')} {mentions.length > 0 && `(${mentions.length})`}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-48">
        <div className="space-y-2">
          <DropdownMenuLabel>{t('Mentions')}:</DropdownMenuLabel>
          {parentEventPubkey && (
            <DropdownMenuCheckboxItem className="flex gap-1 items-center" checked disabled>
              <SimpleUserAvatar userId={parentEventPubkey} size="small" />
              <SimpleUsername
                userId={parentEventPubkey}
                className="font-semibold text-sm truncate"
                skeletonClassName="h-3"
              />
            </DropdownMenuCheckboxItem>
          )}
          {(pubkeys.length > 0 || relatedPubkeys.length > 0) && <DropdownMenuSeparator />}
          {pubkeys.concat(relatedPubkeys).map((pubkey, index) => (
            <DropdownMenuCheckboxItem
              key={`${pubkey}-${index}`}
              className="flex gap-1 items-center cursor-pointer"
              checked={mentions.includes(pubkey)}
              onCheckedChange={(checked) => {
                if (checked) {
                  setAddedPubkeys((pubkeys) => [...pubkeys, pubkey])
                  setRemovedPubkeys((pubkeys) => pubkeys.filter((p) => p !== pubkey))
                } else {
                  setRemovedPubkeys((pubkeys) => [...pubkeys, pubkey])
                  setAddedPubkeys((pubkeys) => pubkeys.filter((p) => p !== pubkey))
                }
              }}
            >
              <SimpleUserAvatar userId={pubkey} size="small" />
              <SimpleUsername
                userId={pubkey}
                className="font-semibold text-sm truncate"
                skeletonClassName="h-3"
              />
            </DropdownMenuCheckboxItem>
          ))}
          {(relatedPubkeys.length > 0 || pubkeys.length > 0) && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => {
                  setAddedPubkeys([...relatedPubkeys])
                  setRemovedPubkeys([])
                }}
              >
                {t('Select all')}
              </DropdownMenuItem>
            </>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
