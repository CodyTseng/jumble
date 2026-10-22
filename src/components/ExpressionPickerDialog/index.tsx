import ExpressionPicker from '@/components/ExpressionPicker'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Modal, ModalContent, ModalTrigger } from '@/components/ui/modal'
import { useScreenSize } from '@/providers/ScreenSizeProvider'
import { TGif } from '@/services/klipy.service'
import { TEmoji } from '@/types'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

export default function ExpressionPickerDialog({
  children,
  onEmojiClick,
  onGifClick,
  enableGif = false,
  onOpenChange
}: {
  children: React.ReactNode
  onEmojiClick?: (emoji: string | TEmoji) => void
  onGifClick?: (gif: TGif) => void
  enableGif?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const { t } = useTranslation()
  const { isSmallScreen } = useScreenSize()
  const [open, setOpen] = useState(false)

  const handleOpenChange = (value: boolean) => {
    // Note: Modal itself blurs the active element when opening, so we don't
    // need to do it here for the mobile path.
    setOpen(value)
    onOpenChange?.(value)
  }

  const handleEmojiPick = (emoji: string | TEmoji) => {
    setOpen(false)
    onOpenChange?.(false)
    onEmojiClick?.(emoji)
  }

  const handleGifPick = (gif: TGif) => {
    setOpen(false)
    onOpenChange?.(false)
    onGifClick?.(gif)
  }

  if (isSmallScreen) {
    return (
      <Modal open={open} onOpenChange={handleOpenChange}>
        <ModalTrigger asChild>{children}</ModalTrigger>
        <ModalContent title={t('Expression picker')} onClick={(e) => e.stopPropagation()}>
          <ExpressionPicker
            onEmojiClick={handleEmojiPick}
            onGifClick={handleGifPick}
            enableGif={enableGif}
          />
        </ModalContent>
      </Modal>
    )
  }

  return (
    <DropdownMenu open={open} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent side="top" className="w-fit p-0" onClick={(e) => e.stopPropagation()}>
        <ExpressionPicker
          onEmojiClick={handleEmojiPick}
          onGifClick={handleGifPick}
          enableGif={enableGif}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
