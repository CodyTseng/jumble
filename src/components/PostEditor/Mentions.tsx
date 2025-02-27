import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { extractMentions } from '@/lib/event'
import { useNostr } from '@/providers/NostrProvider'
import { Check } from 'lucide-react'
import { Event } from 'nostr-tools'
import { HTMLAttributes, useEffect, useState } from 'react'
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
    <Popover>
      <PopoverTrigger asChild>
        <Button
          className="px-3"
          variant="ghost"
          disabled={pubkeys.length === 0 && relatedPubkeys.length === 0 && !parentEventPubkey}
          onClick={(e) => e.stopPropagation()}
        >
          {t('Mentions')} {mentions.length > 0 && `(${mentions.length})`}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-52 p-0 py-1">
        <div className="space-y-1">
          {parentEventPubkey && (
            <PopoverCheckboxItem checked disabled>
              <SimpleUserAvatar userId={parentEventPubkey} size="small" />
              <SimpleUsername
                userId={parentEventPubkey}
                className="font-semibold text-sm truncate"
                skeletonClassName="h-3"
              />
            </PopoverCheckboxItem>
          )}
          {pubkeys.concat(relatedPubkeys).map((pubkey, index) => (
            <PopoverCheckboxItem
              key={`${pubkey}-${index}`}
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
            </PopoverCheckboxItem>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}

function PopoverCheckboxItem({
  children,
  checked,
  onCheckedChange,
  disabled,
  ...props
}: HTMLAttributes<HTMLButtonElement> & {
  disabled?: boolean
  checked: boolean
  onCheckedChange?: (checked: boolean) => void
}) {
  return (
    <div className="px-1">
      <Button
        variant="ghost"
        className="w-full rounded-md justify-start px-2"
        onClick={() => onCheckedChange?.(!checked)}
        disabled={disabled}
        {...props}
      >
        {checked ? <Check className="shrink-0" /> : <div className="w-4 shrink-0" />}
        {children}
      </Button>
    </div>
  )
}
