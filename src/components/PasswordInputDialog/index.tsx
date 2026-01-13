import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

type PasswordInputDialogProps = {
  open: boolean
  title?: string
  description?: string
  onConfirm: (password: string) => void
  onCancel: () => void
}

export default function PasswordInputDialog({
  open,
  title,
  description,
  onConfirm,
  onCancel
}: PasswordInputDialogProps) {
  const { t } = useTranslation()
  const [password, setPassword] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setPassword('')
      // Focus input after dialog opens
      setTimeout(() => {
        inputRef.current?.focus()
      }, 100)
    }
  }, [open])

  const handleConfirm = () => {
    if (password) {
      onConfirm(password)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && password) {
      handleConfirm()
    }
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title || t('Enter Password')}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <Input
          ref={inputRef}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t('Password')}
        />
        <DialogFooter className="w-full flex flex-wrap gap-2">
          <Button variant="outline" onClick={onCancel} className="flex-1">
            {t('Cancel')}
          </Button>
          <Button onClick={handleConfirm} disabled={!password} className="flex-1">
            {t('Confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
