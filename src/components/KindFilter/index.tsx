import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Drawer, DrawerContent, DrawerHeader, DrawerTrigger } from '@/components/ui/drawer'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { DEFAULT_SHOW_KINDS, ExtendedKind } from '@/constants'
import { cn } from '@/lib/utils'
import { useKindFilter } from '@/providers/KindFilterProvider'
import { useScreenSize } from '@/providers/ScreenSizeProvider'
import { ListFilter } from 'lucide-react'
import { kinds } from 'nostr-tools'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

const SUPPORTED_KINDS = [
  { kindGroup: [kinds.ShortTextNote, ExtendedKind.COMMENT], label: 'Posts' },
  { kindGroup: [kinds.Repost], label: 'Reposts' },
  { kindGroup: [kinds.LongFormArticle], label: 'Articles' },
  { kindGroup: [kinds.Highlights], label: 'Highlights' },
  { kindGroup: [ExtendedKind.POLL], label: 'Polls' },
  { kindGroup: [ExtendedKind.VOICE, ExtendedKind.VOICE_COMMENT], label: 'Voice Posts' },
  { kindGroup: [ExtendedKind.PICTURE], label: 'Photo Posts' }
]

export default function KindFilter({
  showKinds,
  onShowKindsChange
}: {
  showKinds: number[]
  onShowKindsChange: (kinds: number[]) => void
}) {
  const { t } = useTranslation()
  const { isSmallScreen } = useScreenSize()
  const [open, setOpen] = useState(false)
  const { updateShowKinds } = useKindFilter()
  const [temporaryShowKinds, setTemporaryShowKinds] = useState(showKinds)
  const [isPersistent, setIsPersistent] = useState(false)
  const isFilterApplied = useMemo(() => {
    return showKinds.length !== DEFAULT_SHOW_KINDS.length
  }, [showKinds])

  useEffect(() => {
    setTemporaryShowKinds(showKinds)
  }, [open])

  const handleApply = () => {
    if (temporaryShowKinds.length === 0) {
      // must select at least one kind
      return
    }

    const newShowKinds = [...temporaryShowKinds].sort()
    let isSame = true
    for (let index = 0; index < newShowKinds.length; index++) {
      if (showKinds[index] !== newShowKinds[index]) {
        isSame = false
        break
      }
    }
    if (!isSame) {
      onShowKindsChange(newShowKinds)
    }

    if (isPersistent) {
      updateShowKinds(newShowKinds)
    }

    setIsPersistent(false)
    setOpen(false)
  }

  const trigger = (
    <Button
      variant="ghost"
      size="titlebar-icon"
      className={cn('mr-1', !isFilterApplied && 'text-muted-foreground')}
      onClick={() => {
        if (isSmallScreen) {
          setOpen(true)
        }
      }}
    >
      <ListFilter />
    </Button>
  )

  const content = (
    <div>
      <div className="grid grid-cols-2 gap-2">
        {SUPPORTED_KINDS.map(({ kindGroup, label }) => (
          <Label
            key={label}
            className="focus:bg-accent/50 cursor-pointer flex items-start gap-3 rounded-lg border px-4 py-3 has-[[aria-checked=true]]:border-primary has-[[aria-checked=true]]:bg-primary/20"
          >
            <Checkbox
              id="toggle-2"
              checked={kindGroup.every((k) => temporaryShowKinds.includes(k))}
              onCheckedChange={(checked) => {
                if (checked) {
                  // add all kinds in this group
                  setTemporaryShowKinds((prev) => Array.from(new Set([...prev, ...kindGroup])))
                } else {
                  // remove all kinds in this group
                  setTemporaryShowKinds((prev) => prev.filter((k) => !kindGroup.includes(k)))
                }
              }}
            />
            <div className="grid gap-1.5">
              <p className="leading-none font-medium">{label}</p>
              <p className="text-muted-foreground text-xs">kind {kindGroup.join(', ')}</p>
            </div>
          </Label>
        ))}
      </div>

      <div className="flex gap-2 mt-4">
        <Button
          variant="secondary"
          onClick={() => {
            setTemporaryShowKinds(DEFAULT_SHOW_KINDS)
          }}
          className="flex-1"
        >
          {t('Select All')}
        </Button>
        <Button
          variant="secondary"
          onClick={() => {
            setTemporaryShowKinds([])
          }}
          className="flex-1"
        >
          {t('Clear All')}
        </Button>
      </div>

      <Label className="flex items-center gap-2 cursor-pointer mt-4">
        <Checkbox
          id="persistent-filter"
          checked={isPersistent}
          onCheckedChange={(checked) => setIsPersistent(!!checked)}
        />
        <span className="text-sm">{t('Remember my choice')}</span>
      </Label>

      <Button
        onClick={handleApply}
        className="mt-4 w-full"
        disabled={temporaryShowKinds.length === 0}
      >
        {t('Apply')}
      </Button>
    </div>
  )

  if (isSmallScreen) {
    return (
      <>
        {trigger}
        <Drawer open={open} onOpenChange={setOpen}>
          <DrawerTrigger asChild></DrawerTrigger>
          <DrawerContent className="px-4">
            <DrawerHeader />
            {content}
          </DrawerContent>
        </Drawer>
      </>
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent className="w-96" collisionPadding={16}>
        {content}
      </PopoverContent>
    </Popover>
  )
}
