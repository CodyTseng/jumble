import RelaySettings from '@/components/RelaySettings'
import { Drawer, DrawerContent, DrawerTrigger } from '@/components/ui/drawer'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useRelaySettings } from '@/providers/RelaySettingsProvider'
import { useScreenSize } from '@/providers/ScreenSizeProvider'
import { ChevronDown, Server } from 'lucide-react'
import { useState } from 'react'

export default function RelaySettingsButton() {
  const { isSmallScreen } = useScreenSize()
  const [open, setOpen] = useState(false)
  const { relayGroups } = useRelaySettings()
  const activeGroup = relayGroups.find((group) => group.isActive)
  const title = activeGroup ? activeGroup.groupName : 'Choose a relay collection'

  const trigger = (
    <div
      className="flex items-center gap-2 clickable px-3 h-full rounded-lg"
      onClick={() => setOpen(true)}
    >
      <Server />
      <div className="text-lg font-semibold">{title}</div>
      <ChevronDown />
    </div>
  )

  if (isSmallScreen) {
    return (
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerTrigger asChild>{trigger}</DrawerTrigger>
        <DrawerContent>
          <div className="max-h-full overflow-auto p-4">
            <RelaySettings />
          </div>
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent className="w-96 h-[450px] p-0" side="bottom">
        <ScrollArea className="h-full">
          <div className="p-4">
            <RelaySettings />
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}
