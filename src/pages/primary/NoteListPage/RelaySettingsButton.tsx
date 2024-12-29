import RelaySettings from '@/components/RelaySettings'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { simplifyUrl } from '@/lib/url'
import { useRelaySettings } from '@/providers/RelaySettingsProvider'
import { useScreenSize } from '@/providers/ScreenSizeProvider'
import { ChevronDown, Server } from 'lucide-react'

export default function RelaySettingsButton() {
  const { isSmallScreen } = useScreenSize()

  if (isSmallScreen) {
    return (
      <Sheet>
        <SheetTrigger>
          <RelaySettingsTrigger />
        </SheetTrigger>
        <SheetContent side="top">
          <RelaySettings />
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <Popover>
      <PopoverTrigger>
        <RelaySettingsTrigger />
      </PopoverTrigger>
      <PopoverContent className="w-96 h-[450px] p-4" side="bottom">
        <RelaySettings />
      </PopoverContent>
    </Popover>
  )
}

function RelaySettingsTrigger({ onClick }: { onClick?: () => void }) {
  const { relayGroups } = useRelaySettings()
  const activeGroup = relayGroups.find((group) => group.isActive)
  const title = activeGroup
    ? activeGroup.relayUrls.length === 1
      ? simplifyUrl(activeGroup.relayUrls[0])
      : activeGroup.groupName
    : 'Choose a relay collection'

  return (
    <div className="flex items-center gap-2 clickable px-3 h-full rounded-lg" onClick={onClick}>
      <Server />
      <div className="text-lg font-semibold">{title}</div>
      <ChevronDown />
    </div>
  )
}
