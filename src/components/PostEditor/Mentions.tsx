import { Button } from '@/components/ui/button'
import { Drawer, DrawerContent } from '@/components/ui/drawer'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { extractMentions } from '@/lib/mentions'
import { cn } from '@/lib/utils'
import { useMuteList } from '@/providers/MuteListProvider'
import { useNostr } from '@/providers/NostrProvider'
import { useScreenSize } from '@/providers/ScreenSizeProvider'
import { Check, ChevronDown } from 'lucide-react'
import { Event } from 'nostr-tools'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { SimpleUserAvatar } from '../UserAvatar'
import { SimpleUsername } from '../Username'

export default function Mentions({
  content,
  mentions,
  setMentions,
  parentEvent,
  initialRemovedPubkeys,
  onRemovedPubkeysChange,
  onLoadingChange,
  compact = false
}: {
  content: string
  mentions: string[]
  setMentions: (mentions: string[]) => void
  parentEvent?: Event
  initialRemovedPubkeys?: string[]
  onRemovedPubkeysChange?: (pubkeys: string[]) => void
  onLoadingChange?: (loading: boolean) => void
  compact?: boolean
}) {
  const { pubkey } = useNostr()
  const { mutePubkeySet } = useMuteList()
  const [potentialMentions, setPotentialMentions] = useState<string[]>([])
  const [parentEventPubkey, setParentEventPubkey] = useState<string | undefined>()
  const removedPubkeysRef = useRef<string[]>(initialRemovedPubkeys ?? [])

  useEffect(() => {
    let cancelled = false
    onLoadingChange?.(true)
    extractMentions(content, parentEvent).then(({ pubkeys, relatedPubkeys, parentEventPubkey }) => {
      if (cancelled) return
      const _parentEventPubkey = parentEventPubkey !== pubkey ? parentEventPubkey : undefined
      setParentEventPubkey(_parentEventPubkey)
      const potentialMentions = [...pubkeys, ...relatedPubkeys].filter((p) => p !== pubkey)
      if (_parentEventPubkey) {
        potentialMentions.push(_parentEventPubkey)
      }
      const removedPubkeys = Array.from(
        new Set(
          removedPubkeysRef.current
            .filter((p) => potentialMentions.includes(p))
            .concat(
              potentialMentions.filter((p) => mutePubkeySet.has(p) && p !== _parentEventPubkey)
            )
        )
      )
      removedPubkeysRef.current = removedPubkeys
      // Publish the default selection in the same update as the available
      // users. Do not overwrite a restored draft with [] while resolving IDs.
      setMentions(potentialMentions.filter((p) => !removedPubkeys.includes(p)))
      onRemovedPubkeysChange?.(removedPubkeys)
      setPotentialMentions(potentialMentions)
      onLoadingChange?.(false)
    })
    return () => {
      cancelled = true
    }
  }, [content, parentEvent, pubkey, mutePubkeySet])

  return (
    <MentionPicker
      compact={compact}
      potentialMentions={potentialMentions}
      mentions={mentions}
      parentEventPubkey={parentEventPubkey}
      setMentions={(selected) => {
        const removed = potentialMentions.filter((p) => !selected.includes(p))
        removedPubkeysRef.current = removed
        setMentions(selected)
        onRemovedPubkeysChange?.(removed)
      }}
    />
  )
}

export function MentionPicker({
  potentialMentions,
  mentions,
  setMentions,
  parentEventPubkey,
  compact = false
}: {
  potentialMentions: string[]
  mentions: string[]
  setMentions: (mentions: string[]) => void
  parentEventPubkey?: string
  compact?: boolean
}) {
  const { t } = useTranslation()
  const { isSmallScreen } = useScreenSize()
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const items = potentialMentions
    .slice()
    .reverse()
    .map((pubkey) => (
      <MenuItem
        key={pubkey}
        checked={mentions.includes(pubkey)}
        disabled={pubkey === parentEventPubkey}
        onCheckedChange={(checked) => {
          if (pubkey === parentEventPubkey) return
          setMentions(
            potentialMentions.filter((p) => (p === pubkey ? checked : mentions.includes(p)))
          )
        }}
      >
        <SimpleUserAvatar userId={pubkey} size="small" />
        <SimpleUsername
          userId={pubkey}
          className="truncate text-sm font-semibold"
          skeletonClassName="h-3"
        />
      </MenuItem>
    ))

  const triggerLabel = compact ? (
    <>
      {mentions.length}/{potentialMentions.length}
      <ChevronDown className="size-3.5" />
    </>
  ) : (
    <>
      {t('Mentions')}{' '}
      {potentialMentions.length > 0 && `(${mentions.length}/${potentialMentions.length})`}
    </>
  )

  if (isSmallScreen) {
    return (
      <>
        <Button
          className="px-3"
          aria-label={t('Mentions')}
          variant="ghost"
          disabled={potentialMentions.length === 0}
          onClick={() => setIsDrawerOpen(true)}
        >
          {triggerLabel}
        </Button>
        <Drawer open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
          <DrawerContent title={t('Mentions')} className="max-h-[80dvh]">
            <div className="overflow-y-auto overscroll-contain py-2">{items}</div>
          </DrawerContent>
        </Drawer>
      </>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          className="px-3"
          aria-label={t('Mentions')}
          variant="ghost"
          disabled={potentialMentions.length === 0}
          onClick={(e) => e.stopPropagation()}
        >
          {triggerLabel}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-[50vh] max-w-96" showScrollButtons>
        {items}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function MenuItem({
  children,
  checked,
  disabled,
  onCheckedChange
}: {
  children: React.ReactNode
  checked: boolean
  disabled?: boolean
  onCheckedChange: (checked: boolean) => void
}) {
  const { isSmallScreen } = useScreenSize()

  if (isSmallScreen) {
    return (
      <div
        onClick={() => {
          if (disabled) return
          onCheckedChange(!checked)
        }}
        className={cn(
          'clickable flex items-center gap-2 px-4 py-3',
          disabled ? 'pointer-events-none opacity-50' : ''
        )}
      >
        <div className="flex size-4 shrink-0 items-center justify-center">
          {checked && <Check className="size-4" />}
        </div>
        {children}
      </div>
    )
  }

  return (
    <DropdownMenuCheckboxItem
      checked={checked}
      disabled={disabled}
      onSelect={(e) => e.preventDefault()}
      onCheckedChange={onCheckedChange}
      className="flex items-center gap-2"
    >
      {children}
    </DropdownMenuCheckboxItem>
  )
}
