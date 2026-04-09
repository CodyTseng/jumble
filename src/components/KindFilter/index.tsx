import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Drawer, DrawerContent, DrawerHeader, DrawerTrigger } from '@/components/ui/drawer'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ExtendedKind } from '@/constants'
import { cn } from '@/lib/utils'
import { useKindFilter } from '@/providers/KindFilterProvider'
import { useScreenSize } from '@/providers/ScreenSizeProvider'
import { ListFilter } from 'lucide-react'
import { kinds } from 'nostr-tools'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

export const KIND_FILTER_OPTIONS = [
  { kindGroup: [kinds.ShortTextNote, ExtendedKind.COMMENT], label: 'Posts' },
  { kindGroup: [kinds.Repost, kinds.GenericRepost], label: 'Reposts' },
  { kindGroup: [kinds.LongFormArticle], label: 'Articles' },
  { kindGroup: [kinds.Highlights], label: 'Highlights' },
  { kindGroup: [ExtendedKind.POLL], label: 'Polls' },
  { kindGroup: [ExtendedKind.VOICE, ExtendedKind.VOICE_COMMENT], label: 'Voice Posts' },
  { kindGroup: [ExtendedKind.PICTURE], label: 'Photo Posts' },
  {
    kindGroup: [
      ExtendedKind.VIDEO,
      ExtendedKind.SHORT_VIDEO,
      ExtendedKind.ADDRESSABLE_NORMAL_VIDEO,
      ExtendedKind.ADDRESSABLE_SHORT_VIDEO
    ],
    label: 'Video Posts'
  }
]
const ALL_KINDS = KIND_FILTER_OPTIONS.flatMap(({ kindGroup }) => kindGroup)

export default function KindFilter({
  feedId,
  showKinds,
  onShowKindsChange
}: {
  feedId: string
  showKinds: number[]
  onShowKindsChange: (kinds: number[]) => void
}) {
  const { t } = useTranslation()
  const { isSmallScreen } = useScreenSize()
  const { showKinds: defaultShowKinds, updateShowKinds, updateShowKindsForFeed, clearShowKindsForFeed } = useKindFilter()
  const [open, setOpen] = useState(false)
  const [temporaryShowKinds, setTemporaryShowKinds] = useState(showKinds)
  const [isPersistent, setIsPersistent] = useState(false)
  const isDifferentFromDefault = useMemo(
    () => !isSameKindFilter(showKinds, defaultShowKinds),
    [showKinds, defaultShowKinds]
  )

  useEffect(() => {
    setTemporaryShowKinds(showKinds)
    setIsPersistent(false)
  }, [open])

  const handleApply = () => {
    if (temporaryShowKinds.length === 0) {
      return
    }

    const newShowKinds = [...temporaryShowKinds].sort()

    if (isPersistent) {
      updateShowKinds(newShowKinds)
      clearShowKindsForFeed(feedId)
      if (!isSameKindFilter(newShowKinds, showKinds)) {
        onShowKindsChange(newShowKinds)
      }
    } else {
      if (!isSameKindFilter(newShowKinds, showKinds)) {
        onShowKindsChange(newShowKinds)
      }
      updateShowKindsForFeed(feedId, newShowKinds)
    }

    setIsPersistent(false)
    setOpen(false)
  }

  const trigger = (
    <Button
      variant="ghost"
      size="titlebar-icon"
      className={cn(
        'relative hover:text-foreground',
        !isDifferentFromDefault && 'text-muted-foreground'
      )}
      onClick={() => {
        if (isSmallScreen) {
          setOpen(true)
        }
      }}
    >
      <ListFilter size={16} />
      {isDifferentFromDefault && (
        <div className="absolute left-7 top-2 size-2 rounded-full bg-primary ring-2 ring-background" />
      )}
    </Button>
  )

  const content = (
    <div>
      <div className="grid grid-cols-2 gap-2">
        {KIND_FILTER_OPTIONS.map(({ kindGroup, label }) => {
          const checked = kindGroup.every((k) => temporaryShowKinds.includes(k))
          return (
            <div
              key={label}
              className={cn(
                'grid cursor-pointer gap-1.5 rounded-lg border px-4 py-3',
                checked ? 'border-primary/60 bg-primary/5' : 'clickable'
              )}
              onClick={() => {
                if (!checked) {
                  setTemporaryShowKinds((prev) => Array.from(new Set([...prev, ...kindGroup])))
                } else {
                  setTemporaryShowKinds((prev) => prev.filter((k) => !kindGroup.includes(k)))
                }
              }}
            >
              <p className="font-medium leading-none">{t(label)}</p>
              <p className="text-xs text-muted-foreground">kind {kindGroup.join(', ')}</p>
            </div>
          )
        })}
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <Button
          variant="secondary"
          onClick={() => {
            setTemporaryShowKinds(ALL_KINDS)
          }}
        >
          {t('Select All')}
        </Button>
        <Button
          variant="secondary"
          onClick={() => {
            setTemporaryShowKinds([])
          }}
        >
          {t('Clear All')}
        </Button>
        <Button
          variant="secondary"
          onClick={() => setTemporaryShowKinds(defaultShowKinds)}
          disabled={isSameKindFilter(temporaryShowKinds, defaultShowKinds)}
        >
          {t('Reset')}
        </Button>
      </div>

      <Label className="mt-4 flex cursor-pointer items-center gap-2">
        <Checkbox
          id="persistent-filter"
          checked={isPersistent}
          onCheckedChange={(checked) => setIsPersistent(!!checked)}
        />
        <span className="text-sm">{t('Set as default filter')}</span>
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
      <PopoverContent className="w-96" collisionPadding={16} sideOffset={0}>
        {content}
      </PopoverContent>
    </Popover>
  )
}

function isSameKindFilter(a: number[], b: number[]) {
  if (a.length !== b.length) {
    return false
  }
  const sortedA = [...a].sort()
  const sortedB = [...b].sort()
  return sortedA.every((value, index) => value === sortedB[index])
}
