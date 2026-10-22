import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import dialogService from '@/services/dialog.service'
import { useAtomValue } from 'jotai'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

export default function DialogHost() {
  const { t } = useTranslation()
  const request = useAtomValue(dialogService.requestAtom)
  if (!request) return null

  if (request.type === 'prompt') {
    return (
      <PromptDialog
        key={request.id}
        id={request.id}
        message={request.message}
        defaultValue={request.defaultValue}
      />
    )
  }

  return (
    <AlertDialog
      key={request.id}
      open
      onOpenChange={(open) => !open && dialogService.respond(request.id, false)}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('Confirm')}</AlertDialogTitle>
          <AlertDialogDescription className="whitespace-pre-wrap">
            {request.message}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => dialogService.respond(request.id, false)}>
            {t('Cancel')}
          </AlertDialogCancel>
          <AlertDialogAction onClick={() => dialogService.respond(request.id, true)}>
            {t('Confirm')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

function PromptDialog({
  id,
  message,
  defaultValue
}: {
  id: number
  message: string
  defaultValue: string
}) {
  const { t } = useTranslation()
  const [value, setValue] = useState(defaultValue)
  return (
    <Dialog open onOpenChange={(open) => !open && dialogService.respond(id, null)}>
      <DialogContent aria-describedby={undefined}>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            dialogService.respond(id, value)
          }}
        >
          <DialogHeader>
            <DialogTitle>{message}</DialogTitle>
          </DialogHeader>
          <Input
            aria-label={message}
            dir="auto"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => dialogService.respond(id, null)}>
              {t('Cancel')}
            </Button>
            <Button type="submit">{t('Confirm')}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
