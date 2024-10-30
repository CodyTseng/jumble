import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@renderer/components/ui/dialog'
import { ScrollArea, ScrollBar } from '@renderer/components/ui/scroll-area'
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
        </DialogHeader>
        <ScrollArea className="h-full">
          <pre className="text-sm overflow-x-auto text-muted-foreground">
            {JSON.stringify(event, null, 2)}
          </pre>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
