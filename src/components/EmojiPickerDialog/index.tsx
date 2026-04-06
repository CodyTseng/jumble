import { Drawer, DrawerContent, DrawerTrigger } from '@/components/ui/drawer'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { useScreenSize } from '@/providers/ScreenSizeProvider'
import { TEmoji } from '@/types'
import { useState } from 'react'
import EmojiPicker from '../EmojiPicker'

export default function EmojiPickerDialog({
  children,
  onEmojiClick,
  onOpenChange
}: {
  children: React.ReactNode
  onEmojiClick?: (emoji: string | TEmoji | undefined) => void
  onOpenChange?: (open: boolean) => void
}) {
  const { isSmallScreen } = useScreenSize()
  const [open, setOpen] = useState(false)

  const handleOpenChange = (value: boolean) => {
    setOpen(value)
    onOpenChange?.(value)
  }

  if (isSmallScreen) {
    return (
      <Drawer open={open} onOpenChange={handleOpenChange}>
        <DrawerTrigger asChild>{children}</DrawerTrigger>
        <DrawerContent>
          <EmojiPicker
            onEmojiClick={(emoji, e) => {
              e.stopPropagation()
              setOpen(false)
              onEmojiClick?.(emoji)
            }}
          />
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <DropdownMenu open={open} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent side="top" className="w-fit p-0">
        <EmojiPicker
          onEmojiClick={(emoji, e) => {
            e.stopPropagation()
            setOpen(false)
            onEmojiClick?.(emoji)
          }}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
