import RelaySettings from '@/components/RelaySettings'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { simplifyUrl } from '@/lib/url'
import { useRelaySettings } from '@/providers/RelaySettingsProvider'
import { useScreenSize } from '@/providers/ScreenSizeProvider'
import { ChevronDown, Server } from 'lucide-react'
import { forwardRef } from 'react'

export default function RelaySettingsButton() {
  const { isSmallScreen } = useScreenSize()

  if (isSmallScreen) {
    return (
      <Sheet>
        <SheetTrigger asChild>
          <RelaySettingsTrigger />
        </SheetTrigger>
        <SheetContent side="top" className="max-h-full overflow-auto">
          <RelaySettings />
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <RelaySettingsTrigger />
      </PopoverTrigger>
      <PopoverContent side="bottom" className="w-96 p-4 max-h-[80vh] overflow-auto">
        <RelaySettings />
      </PopoverContent>
    </Popover>
  )
}

const RelaySettingsTrigger = forwardRef<HTMLDivElement>((props, ref) => {
  const { relayGroups } = useRelaySettings()
  const activeGroup = relayGroups.find((group) => group.isActive)
  const title = activeGroup
    ? activeGroup.relayUrls.length === 1
      ? simplifyUrl(activeGroup.relayUrls[0])
      : activeGroup.groupName
    : 'Choose a relay collection'

  return (
    <div className="flex items-center gap-2 clickable px-3 h-full rounded-lg" ref={ref} {...props}>
      <Server />
      <div className="text-lg font-semibold">{title}</div>
      <ChevronDown />
    </div>
  )
})
