import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { Event } from 'nostr-tools'

export default function RawEventDialog({
  event,
  isOpen,
  onClose
}: {
  event: Event
  isOpen: boolean
  onClose: () => void
}) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="h-[60vh]">
        <DialogHeader>
          <DialogTitle>Raw Event</DialogTitle>
          <DialogDescription className="hidden" />
        </DialogHeader>
        <ScrollArea className="h-full">
          <pre className="text-sm text-muted-foreground">{JSON.stringify(event, null, 2)}</pre>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
