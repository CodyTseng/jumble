import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@renderer/components/ui/dropdown-menu'
import { Ellipsis } from 'lucide-react'
import { Event } from 'nostr-tools'
import RawEventDialog from './RawEventDialog'
import { useState } from 'react'

export default function NoteOptionsTrigger({ event }: { event: Event }) {
  const [isRawEventDialogOpen, setIsRawEventDialogOpen] = useState(false)

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger>
          <Ellipsis
            size={16}
            className="text-muted-foreground hover:text-foreground cursor-pointer"
          />
        </DropdownMenuTrigger>
        <DropdownMenuContent collisionPadding={8}>
          <DropdownMenuItem onClick={() => setIsRawEventDialogOpen(true)}>
            raw event
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <RawEventDialog
        event={event}
        isOpen={isRawEventDialogOpen}
        onClose={() => setIsRawEventDialogOpen(false)}
      />
    </>
  )
}
