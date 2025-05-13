import { Dispatch, useEffect, useMemo, useRef, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogOverlay
} from '@/components/ui/dialog'
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerOverlay,
  DrawerTitle
} from '@/components/ui/drawer'
import { ScrollArea } from '@/components/ui/scroll-area'

import { useScreenSize } from '@/providers/ScreenSizeProvider'
import { Event } from 'nostr-tools'
import NormalPostContent from './NormalPostContent'
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
  const drawerContentRef = useRef<HTMLDivElement | null>(null)

  const [viewportHeight, setViewportHeight] = useState('100vh')

  useEffect(() => {
    const handleResize = () => {
      const vh = window.innerHeight * 0.01
      setViewportHeight(`${vh * 100}px`)
    }

    handleResize() // initial run
    window.addEventListener('resize', handleResize)

    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const content = useMemo(() => {
    return (
      <NormalPostContent
        defaultContent={defaultContent}
        parentEvent={parentEvent}
        close={() => setOpen(false)}
      />
    )
  }, [])

  if (isSmallScreen) {
    return (
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerOverlay onClick={() => setOpen(false)} />
        <DrawerContent
          onOpenAutoFocus={(e) => e.preventDefault()}
          ref={drawerContentRef}
          style={{ height: viewportHeight, paddingBottom: 'env(safe-area-inset-bottom)' }}
          className="flex flex-col px-4 pt-10"
        >
          <DrawerHeader>
            <DrawerTitle className="text-start">
              <Title parentEvent={parentEvent} />
            </DrawerTitle>
          </DrawerHeader>
          <ScrollArea className="flex-1">{content}</ScrollArea>
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogOverlay onClick={() => setOpen(false)} />
      <DialogContent className="p-0 max-w-2xl" withoutClose>
        <ScrollArea className="px-4 h-full max-h-screen">
          <div className="space-y-4 px-2 py-6">
            <DialogHeader>
              <DialogTitle>
                <Title parentEvent={parentEvent} />
              </DialogTitle>
              <DialogDescription className="hidden" />
            </DialogHeader>
            {content}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}

