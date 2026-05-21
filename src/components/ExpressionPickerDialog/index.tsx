import ExpressionPicker from '@/components/ExpressionPicker'
import { Drawer, DrawerContent, DrawerTrigger } from '@/components/ui/drawer'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { useScreenSize } from '@/providers/ScreenSizeProvider'
import { TGif } from '@/services/klipy.service'
import { TEmoji } from '@/types'
import { useState } from 'react'

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
  const { isSmallScreen } = useScreenSize()
  const [open, setOpen] = useState(false)

  const handleOpenChange = (value: boolean) => {
    if (value && document.activeElement instanceof HTMLElement) {
      document.activeElement.blur()
    }
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
      <Drawer open={open} onOpenChange={handleOpenChange}>
        <DrawerTrigger asChild>{children}</DrawerTrigger>
        <DrawerContent onClick={(e) => e.stopPropagation()}>
          <ExpressionPicker
            onEmojiClick={handleEmojiPick}
            onGifClick={handleGifPick}
            enableGif={enableGif}
          />
        </DrawerContent>
      </Drawer>
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
