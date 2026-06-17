import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { useContactNotes } from '@/providers/ContactNotesProvider'
import { TriangleAlert } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

export default function RebrandIndicator({
  pubkey,
  savedName,
  currentName,
  showingSaved,
  className
}: {
  pubkey: string
  savedName: string
  currentName: string
  showingSaved: boolean
  className?: string
}) {
  const { t } = useTranslation()
  const { setName } = useContactNotes()
  const [open, setOpen] = useState(false)
  const [updating, setUpdating] = useState(false)

  const handleApprove = async (e: React.MouseEvent) => {
    e.stopPropagation()
    setUpdating(true)
    try {
      await setName(pubkey, currentName)
      toast.success(t('Saved name updated'))
      setOpen(false)
    } finally {
      setUpdating(false)
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className={cn(
            'inline-flex size-4 shrink-0 items-center justify-center rounded-full text-amber-500 hover:text-amber-400',
            className
          )}
          title={t('Name differs from the one you saved')}
          aria-label={t('Name differs from the one you saved')}
        >
          <TriangleAlert className="size-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 space-y-3" onClick={(e) => e.stopPropagation()}>
        <div className="space-y-1">
          <div className="text-sm font-medium">{t('Name doesn’t match')}</div>
          <div className="text-xs text-muted-foreground">
            {t('This contact is broadcasting a name different from the one you saved.')}
          </div>
        </div>
        <div className="space-y-2 rounded-md border border-border/60 bg-muted/40 p-3 text-sm">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-xs text-muted-foreground">{t('You saved')}</span>
            <span className={cn('truncate font-medium', !showingSaved && 'text-muted-foreground')}>
              {savedName}
            </span>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-xs text-muted-foreground">{t('Now broadcasting')}</span>
            <span className={cn('truncate font-medium', showingSaved && 'text-muted-foreground')}>
              {currentName}
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="flex-1"
            disabled={updating}
            onClick={(e) => {
              e.stopPropagation()
              setOpen(false)
            }}
          >
            {t('Keep')}
          </Button>
          <Button size="sm" className="flex-1" disabled={updating} onClick={handleApprove}>
            {t('Update saved name')}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
