import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useScreenSize } from '@/providers/ScreenSizeProvider'
import { Event } from 'nostr-tools'
import { Dispatch, useMemo } from 'react'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '../ui/sheet'
import NormalPostContent from './NormalPostContent'
import PicturePostContent from './PicturePostContent'
import Title from './Title'
import { useTranslation } from 'react-i18next'

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
  }, [parentEvent])

  if (isSmallScreen) {
    return (
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="h-full w-full p-0 border-none" side="bottom" hideClose>
          <ScrollArea className="px-4 h-full max-h-screen">
            <div className="space-y-4 px-2 py-6">
              <SheetHeader>
                <SheetTitle className="text-start">
                  <Title parentEvent={parentEvent} />
                </SheetTitle>
                <SheetDescription className="hidden" />
              </SheetHeader>
              {content}
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>
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
            {content}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
