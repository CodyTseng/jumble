import RelaySettings from '@renderer/components/RelaySettings'
import { Popover, PopoverContent, PopoverTrigger } from '@renderer/components/ui/popover'
import { ScrollArea } from '@renderer/components/ui/scroll-area'
import { Server } from 'lucide-react'

export default function RelaySettingsPopover() {
  return (
    <Popover>
      <PopoverTrigger
        className="non-draggable h-7 w-7 p-0 rounded-full flex items-center justify-center hover:bg-accent hover:text-accent-foreground"
        title="relay settings"
      >
        <Server size={18} className="text-foreground" />
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
