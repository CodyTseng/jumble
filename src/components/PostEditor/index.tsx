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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useScreenSize } from '@/providers/ScreenSizeProvider'
import { Event } from 'nostr-tools'
import { Dispatch, useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
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
  }, [parentEvent, defaultContent, t, setOpen])

  if (isSmallScreen) {
    return (
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerOverlay onClick={() => setOpen(false)} />
        <DrawerContent
          onOpenAutoFocus={(e) => e.preventDefault()}
          ref={drawerContentRef}
          className="flex flex-col h-full px-4 pt-4 pb-[env(safe-area-inset-bottom)]"
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
