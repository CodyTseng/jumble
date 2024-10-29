import RelaySettings from '@renderer/components/RelaySettings'
import { TitlebarButton } from '@renderer/components/Titlebar'
import { Popover, PopoverContent, PopoverTrigger } from '@renderer/components/ui/popover'
import { ScrollArea } from '@renderer/components/ui/scroll-area'
import { Server } from 'lucide-react'

export default function RelaySettingsPopover() {
  return (
    <Popover>
      <PopoverTrigger>
        <TitlebarButton>
          <Server size={18} className="text-foreground" />
        </TitlebarButton>
      </PopoverTrigger>
      <PopoverContent className="w-[60vw] h-[75vh] p-0">
        <ScrollArea className="h-full">
          <div className="p-4">
            <RelaySettings />
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}
