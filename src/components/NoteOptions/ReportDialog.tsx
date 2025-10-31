import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle
} from '@/components/ui/drawer'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { createReportDraftEvent } from '@/lib/draft-event'
import { useNostr } from '@/providers/NostrProvider'
import { useScreenSize } from '@/providers/ScreenSizeProvider'
import { Loader } from 'lucide-react'
import { NostrEvent } from 'nostr-tools'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

export default function ReportDialog({
  event,
  isOpen,
  closeDialog
}: {
  event: NostrEvent
  isOpen: boolean
  closeDialog: () => void
}) {
  const { isSmallScreen } = useScreenSize()

  if (isSmallScreen) {
    return (
      <Drawer
        open={isOpen}
        onOpenChange={(open) => {
          if (!open) {
            closeDialog()
          }
        }}
      >
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle className="hidden" />
            <DrawerDescription className="hidden" />
          </DrawerHeader>
          <div className="p-4">
            <ReportContent event={event} closeDialog={closeDialog} />
          </div>
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          closeDialog()
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="hidden" />
          <DialogDescription className="hidden" />
        </DialogHeader>
        <ReportContent event={event} closeDialog={closeDialog} />
      </DialogContent>
    </Dialog>
  )
}

function ReportContent({ event, closeDialog }: { event: NostrEvent; closeDialog: () => void }) {
  const { t } = useTranslation()
  const { pubkey, publish } = useNostr()
  const [reason, setReason] = useState<string | null>(null)
  const [reporting, setReporting] = useState(false)

  const handleReport = async () => {
    if (!reason || !pubkey) return

    try {
      setReporting(true)
      const draftEvent = createReportDraftEvent(event, reason)
      await publish(draftEvent)
      toast.success(t('Successfully report'))
      closeDialog()
    } catch (error) {
      const errors = error instanceof AggregateError ? error.errors : [error]
      errors.forEach((err) => {
        toast.error(
          `${t('Failed to report')}: ${err instanceof Error ? err.message : String(err)}`,
          { duration: 10_000 }
        )
        console.error(err)
      })
      return
    } finally {
      setReporting(false)
    }
  }

  return (
    <div className="w-full space-y-4">
      <RadioGroup value={reason} onValueChange={setReason} className="space-y-2">
        {['nudity', 'malware', 'profanity', 'illegal', 'spam', 'other'].map((item) => (
          <div key={item} className="flex items-center space-x-2">
            <RadioGroupItem value={item} id={item} />
            <Label htmlFor={item} className="text-base">
              {t(item)}
            </Label>
          </div>
        ))}
      </RadioGroup>
      <Button
        variant="destructive"
        className="w-full"
        disabled={!reason || reporting}
        onClick={(e) => {
          e.stopPropagation()
          handleReport()
        }}
      >
        {reporting && <Loader className="animate-spin" />}
        {t('Report')}
      </Button>
    </div>
  )
}
