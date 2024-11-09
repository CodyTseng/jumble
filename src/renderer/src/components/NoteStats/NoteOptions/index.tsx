import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@renderer/components/ui/dropdown-menu'
import { getSharableEventId } from '@renderer/lib/event'
import { Code, Copy, Ellipsis } from 'lucide-react'
import { Event } from 'nostr-tools'
import { useState } from 'react'
import RawEventDialog from './RawEventDialog'

export default function NoteOptions({ event }: { event: Event }) {
  const [isRawEventDialogOpen, setIsRawEventDialogOpen] = useState(false)

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger>
          <Ellipsis
            size={14}
            className="text-muted-foreground hover:text-foreground cursor-pointer"
          />
        </DropdownMenuTrigger>
        <DropdownMenuContent collisionPadding={8}>
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation()
              navigator.clipboard.writeText('nostr:' + getSharableEventId(event))
            }}
          >
            <Copy />
            copy embedded code
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation()
              setIsRawEventDialogOpen(true)
            }}
          >
            <Code />
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
