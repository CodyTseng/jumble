import { Drawer, DrawerContent, DrawerTrigger } from '@/components/ui/drawer'
import {
  Dialog,
  DialogContent,
  DialogTrigger
} from '@/components/ui/dialog'
import { useScreenSize } from '@/providers/ScreenSizeProvider'
import { useState } from 'react'
import IconPicker from '../IconPicker'

export default function IconPickerDialog({
  children,
  selectedIcon,
  onIconSelect
}: {
  children: React.ReactNode
  selectedIcon?: string
  onIconSelect: (iconName: string | null) => void
}) {
  const { isSmallScreen } = useScreenSize()
  const [open, setOpen] = useState(false)

  if (isSmallScreen) {
    return (
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerTrigger asChild>{children}</DrawerTrigger>
        <DrawerContent className="max-h-[85vh]">
          <IconPicker
            selectedIcon={selectedIcon}
            onIconSelect={onIconSelect}
            onClose={() => setOpen(false)}
          />
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="p-0 max-w-2xl">
        <IconPicker
          selectedIcon={selectedIcon}
          onIconSelect={onIconSelect}
          onClose={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  )
}
