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
import { useMuteList } from '@/providers/MuteListProvider'

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
  const { mutePubkeys } = useMuteList()
  const [potentialMentions, setPotentialMentions] = useState<string[]>([])
  const [parentEventPubkey, setParentEventPubkey] = useState<string | undefined>()
  const [removedPubkeys, setRemovedPubkeys] = useState<string[]>([])

  useEffect(() => {
    extractMentions(content, parentEvent).then(({ pubkeys, relatedPubkeys, parentEventPubkey }) => {
      const _parentEventPubkey = parentEventPubkey !== pubkey ? parentEventPubkey : undefined
      setParentEventPubkey(_parentEventPubkey)
      const potentialMentions = [...pubkeys, ...relatedPubkeys].filter((p) => p !== pubkey)
      if (_parentEventPubkey) {
        potentialMentions.push(_parentEventPubkey)
      }
      setPotentialMentions(potentialMentions)
      setRemovedPubkeys((pubkeys) => {
        return Array.from(
          new Set(
            pubkeys
              .filter((p) => potentialMentions.includes(p))
              .concat(
                potentialMentions.filter((p) => mutePubkeys.includes(p) && p !== _parentEventPubkey)
              )
          )
        )
      })
    })
  }, [content, parentEvent, pubkey])

  useEffect(() => {
    const newMentions = potentialMentions.filter((pubkey) => !removedPubkeys.includes(pubkey))
    setMentions(newMentions)
  }, [potentialMentions, removedPubkeys])

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          className="px-3"
          variant="ghost"
          disabled={potentialMentions.length === 0}
          onClick={(e) => e.stopPropagation()}
        >
          {t('Mentions')}{' '}
          {potentialMentions.length > 0 && `(${mentions.length}/${potentialMentions.length})`}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-52 p-0 py-1">
        <div className="space-y-1">
          {potentialMentions.map((_, index) => {
            const pubkey = potentialMentions[potentialMentions.length - 1 - index]
            const isParentPubkey = pubkey === parentEventPubkey
            return (
              <PopoverCheckboxItem
                key={`${pubkey}-${index}`}
                checked={isParentPubkey ? true : mentions.includes(pubkey)}
                onCheckedChange={(checked) => {
                  if (isParentPubkey) {
                    return
                  }
                  if (checked) {
                    setRemovedPubkeys((pubkeys) => pubkeys.filter((p) => p !== pubkey))
                  } else {
                    setRemovedPubkeys((pubkeys) => [...pubkeys, pubkey])
                  }
                }}
                disabled={isParentPubkey}
              >
                <SimpleUserAvatar userId={pubkey} size="small" />
                <SimpleUsername
                  userId={pubkey}
                  className="font-semibold text-sm truncate"
                  skeletonClassName="h-3"
                />
              </PopoverCheckboxItem>
            )
          })}
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
