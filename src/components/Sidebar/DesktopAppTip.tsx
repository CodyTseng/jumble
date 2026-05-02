import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { isElectron } from '@/lib/platform'
import { cn } from '@/lib/utils'
import storage from '@/services/local-storage.service'
import { Lightbulb, Monitor, X } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

const DOWNLOAD_URL = 'https://github.com/CodyTseng/jumble/releases/latest'

export default function DesktopAppTip({ collapse }: { collapse: boolean }) {
  const { t } = useTranslation()
  const [dismissed, setDismissed] = useState(() => storage.getDismissedDesktopAppTip())
  const [popoverOpen, setPopoverOpen] = useState(false)

  if (dismissed || isElectron()) return null

  const handleDismiss = () => {
    storage.setDismissedDesktopAppTip(true)
    setDismissed(true)
  }

  const title = (
    <div className="flex items-center gap-1.5 font-semibold">
      <Monitor className="size-3.5" />
      {t('Try the desktop app')}
    </div>
  )

  const description = (
    <div className="text-muted-foreground">
      {t('No browser relay connection limit, for a better following feed experience.')}
    </div>
  )

  const downloadButton = (
    <a href={DOWNLOAD_URL} target="_blank" rel="noreferrer" className="block">
      <Button size="sm" className="h-7 w-full text-xs">
        {t('Download')}
      </Button>
    </a>
  )

  const cardBody = (
    <>
      <div className="relative">
        <button
          className={cn(
            'text-muted-foreground hover:bg-background hover:text-foreground absolute top-0 right-0 rounded-sm p-0.5 transition-colors'
          )}
          onClick={() => {
            handleDismiss()
            setPopoverOpen(false)
          }}
          aria-label={t('Dismiss')}
        >
          <X className="size-3" />
        </button>
        <div className="pr-4">{title}</div>
      </div>
      {description}
      {downloadButton}
    </>
  )

  if (collapse) {
    return (
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            title={t('Try the desktop app')}
            className="bg-primary/10 text-primary hover:bg-primary/20 relative flex size-8 cursor-pointer items-center justify-center self-center rounded-full transition-colors"
          >
            <Lightbulb className="size-4" />
            <span className="bg-primary absolute top-0.5 right-0.5 size-1.5 rounded-full" />
          </button>
        </PopoverTrigger>
        <PopoverContent side="right" align="end" className="w-56 space-y-2 p-3 text-xs">
          {cardBody}
        </PopoverContent>
      </Popover>
    )
  }

  return <div className="bg-muted/40 space-y-2 rounded-lg border p-3 text-xs">{cardBody}</div>
}
