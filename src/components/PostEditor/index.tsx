import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Drawer, DrawerContent } from '@/components/ui/drawer'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useScreenSize } from '@/providers/ScreenSizeProvider'
import postEditor from '@/services/post-editor.service'
import { Event } from 'nostr-tools'
import { Dispatch, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import PostContent from './PostContent'
import Title from './Title'

export default function PostEditor({
  defaultContent = '',
  parentStuff,
  open,
  setOpen,
  openFrom,
  highlightedText
}: {
  defaultContent?: string
  parentStuff?: Event | string
  open: boolean
  setOpen: Dispatch<boolean>
  openFrom?: string[]
  highlightedText?: string
}) {
  const { t } = useTranslation()
  const { isSmallScreen } = useScreenSize()

  const content = useMemo(() => {
    return (
      <PostContent
        defaultContent={defaultContent}
        parentStuff={parentStuff}
        close={() => setOpen(false)}
        openFrom={openFrom}
        highlightedText={highlightedText}
      />
    )
  }, [highlightedText])

  if (isSmallScreen) {
    return (
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent
          className="h-dvh max-h-dvh overflow-hidden"
          title={highlightedText ? t('Create Highlight') : t('New Note')}
          onEscapeKeyDown={(e) => {
            if (postEditor.isSuggestionPopupOpen) {
              e.preventDefault()
              postEditor.closeSuggestionPopup()
            }
          }}
        >
          <ScrollArea className="min-h-0 flex-1">{content}</ScrollArea>
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        className="max-w-2xl p-0 sm:rounded-2xl"
        withoutClose
        onEscapeKeyDown={(e) => {
          if (postEditor.isSuggestionPopupOpen) {
            e.preventDefault()
            postEditor.closeSuggestionPopup()
          }
        }}
      >
        <ScrollArea className="h-full max-h-[85vh]">
          <DialogHeader className="px-6 pt-6 pb-0">
            <DialogTitle>
              {highlightedText ? t('Create Highlight') : <Title parentStuff={parentStuff} />}
            </DialogTitle>
            <DialogDescription className="hidden" />
          </DialogHeader>
          {content}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
