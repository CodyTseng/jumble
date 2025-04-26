import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogOverlay,
  DialogTitle
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useScreenSize } from '@/providers/ScreenSizeProvider'
import { Event } from 'nostr-tools'
import { Dispatch, useMemo, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Drawer, DrawerContent, DrawerHeader, DrawerOverlay, DrawerTitle } from '../ui/drawer'
import NormalPostContent from './NormalPostContent'
import PicturePostContent from './PicturePostContent'
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
  const { t } = useTranslation()
  const { isSmallScreen } = useScreenSize()
  const drawerContentRef = useRef<HTMLDivElement | null>(null)

  const content = useMemo(() => {
    return parentEvent || defaultContent ? (
      <NormalPostContent
        defaultContent={defaultContent}
        parentEvent={parentEvent}
        close={() => setOpen(false)}
      />
    ) : (
      <Tabs defaultValue="normal" className="space-y-4">
        <TabsList>
          <TabsTrigger value="normal">{t('Normal Note')}</TabsTrigger>
          <TabsTrigger value="picture">{t('Picture Note')}</TabsTrigger>
        </TabsList>
        <TabsContent value="normal">
          <NormalPostContent
            defaultContent={defaultContent}
            parentEvent={parentEvent}
            close={() => setOpen(false)}
          />
        </TabsContent>
        <TabsContent value="picture">
          <PicturePostContent close={() => setOpen(false)} />
        </TabsContent>
      </Tabs>
    )
  }, [parentEvent, defaultContent])

  useEffect(() => {
    const handleResize = () => {
      if (drawerContentRef.current) {
        drawerContentRef.current.style.setProperty('bottom', `env(safe-area-inset-bottom)`)
      }
    }

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleResize)
      handleResize()
    }

    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleResize)
      }
    }
  }, [])

  if (isSmallScreen) {
    return (
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerOverlay onClick={() => setOpen(false)} />
        <DrawerContent
          hideOverlay
          onOpenAutoFocus={(e) => e.preventDefault()}
          ref={drawerContentRef}
          className="h-full w-full p-0 flex flex-col"
        >
          <ScrollArea className="px-4 h-full max-h-screen">
            <div className="px-2 pt-6">
              <DrawerHeader>
                <DrawerTitle className="text-start">
                  <Title parentEvent={parentEvent} />
                </DrawerTitle>
                <DialogDescription className="hidden" />
              </DrawerHeader>
              {content}
            </div>
          </ScrollArea>
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogOverlay onClick={() => setOpen(false)} />
      <DialogContent
        hideOverlay
        onOpenAutoFocus={(e) => e.preventDefault()}
        className="p-0 max-w-2xl"
      >
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
