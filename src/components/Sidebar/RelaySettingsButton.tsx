import RelaySettings from '@/components/RelaySettings'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Server } from 'lucide-react'
import SidebarItem from './SidebarItem'

export default function RelaySettingsButton() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <SidebarItem title="Relay settings" description="SidebarRelays">
          <Server />
        </SidebarItem>
      </PopoverTrigger>
      <PopoverContent className="w-96 h-[450px] p-0" side="right">
        <ScrollArea className="h-full">
          <div className="p-4">
            <RelaySettings />
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}
