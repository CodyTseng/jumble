import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle
} from '@/components/ui/drawer'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useScreenSize } from '@/providers/ScreenSizeProvider'
import { Event } from 'nostr-tools'
import { Dispatch } from 'react'
import PostContent from './PostContent'
import Title from './Title'

export default function PostEditor({
  defaultContent = '',
  parentEvent,
  open,
  setOpen
}: {
  defaultContent?: string
  parentEvent?: Event
  open: boolean
  setOpen: Dispatch<boolean>
}) {
  const { isSmallScreen } = useScreenSize()

  if (isSmallScreen) {
    return (
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent className="h-full">
          <DrawerHeader>
            <DrawerTitle className="text-start">
              <Title parentEvent={parentEvent} />
            </DrawerTitle>
            <DrawerDescription className="hidden" />
          </DrawerHeader>
          <div className="overflow-auto py-2 px-4">
            <PostContent
              defaultContent={defaultContent}
              parentEvent={parentEvent}
              close={() => setOpen(false)}
            />
          </div>
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="p-0" withoutClose>
        <ScrollArea className="px-4 h-full max-h-screen">
          <div className="space-y-4 px-2 py-6">
            <DialogHeader>
              <DialogTitle>
                <Title parentEvent={parentEvent} />
              </DialogTitle>
              <DialogDescription className="hidden" />
            </DialogHeader>
            <PostContent
              defaultContent={defaultContent}
              parentEvent={parentEvent}
              close={() => setOpen(false)}
            />
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
