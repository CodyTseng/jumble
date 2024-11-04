import RelaySettings from '@renderer/components/RelaySettings'
import { Button } from '@renderer/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@renderer/components/ui/popover'
import { ScrollArea } from '@renderer/components/ui/scroll-area'
import { Server } from 'lucide-react'

export default function RelaySettingsPopover() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="titlebar" size="titlebar" title="relay settings">
          <Server />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 h-[450px] p-0">
        <ScrollArea className="h-full">
          <div className="p-4">
            <RelaySettings />
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}
