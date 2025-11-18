import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle
} from '@/components/ui/sheet'
import { useScreenSize } from '@/providers/ScreenSizeProvider'
import postEditor from '@/services/post-editor.service'
import { Event } from 'nostr-tools'
import { Dispatch, useMemo } from 'react'
import PostContent from './PostContent'
import Title from './Title'

export default function PostEditor({
  defaultContent = '',
  parentStuff,
  open,
  setOpen,
  openFrom
}: {
  defaultContent?: string
  parentStuff?: Event | string
  open: boolean
  setOpen: Dispatch<boolean>
  openFrom?: string[]
}) {
  const { isSmallScreen } = useScreenSize()

  const content = useMemo(() => {
    return (
      <PostContent
        defaultContent={defaultContent}
        parentStuff={parentStuff}
        close={() => setOpen(false)}
        openFrom={openFrom}
      />
    )
  }, [])

  if (isSmallScreen) {
    return (
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          className="h-full w-full p-0 border-none"
          side="bottom"
          hideClose
          onEscapeKeyDown={(e) => {
            if (postEditor.isSuggestionPopupOpen) {
              e.preventDefault()
              postEditor.closeSuggestionPopup()
            }
          }}
        >
          <ScrollArea className="px-4 h-full max-h-screen">
            <div className="space-y-4 px-2 py-6">
              <SheetHeader>
                <SheetTitle className="text-start">
                  <Title parentStuff={parentStuff} />
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
      <DialogContent
        className="p-0 max-w-2xl"
        withoutClose
        onEscapeKeyDown={(e) => {
          if (postEditor.isSuggestionPopupOpen) {
            e.preventDefault()
            postEditor.closeSuggestionPopup()
          }
        }}
      >
        <ScrollArea className="px-4 h-full max-h-screen">
          <div className="space-y-4 px-2 py-6">
            <DialogHeader>
              <DialogTitle>
                <Title parentStuff={parentStuff} />
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
