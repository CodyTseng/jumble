import { Drawer, DrawerContent, DrawerTrigger } from '@/components/ui/drawer'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { useScreenSize } from '@/providers/ScreenSizeProvider'
import { useState } from 'react'
import EmojiPicker from '../EmojiPicker'

export default function EmojiPickerDialog({
  children,
  onEmojiClick
}: {
  children: React.ReactNode
  onEmojiClick?: (emoji: string) => void
}) {
  const { isSmallScreen } = useScreenSize()
  const [open, setOpen] = useState(false)

  if (isSmallScreen) {
    return (
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerTrigger asChild>{children}</DrawerTrigger>
        <DrawerContent>
          <EmojiPicker
            onEmojiClick={(data, e) => {
              e.stopPropagation()
              setOpen(false)
              onEmojiClick?.(data.emoji)
            }}
          />
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent side="top" className="p-0 w-fit">
        <EmojiPicker
          onEmojiClick={(data, e) => {
            e.stopPropagation()
            setOpen(false)
            onEmojiClick?.(data.emoji)
          }}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
