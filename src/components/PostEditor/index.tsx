import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle
} from '@/components/ui/sheet'
import { useScreenSize } from '@/providers/ScreenSizeProvider'
import postEditor from '@/services/post-editor.service'
import { PencilLine } from 'lucide-react'
import type { Event as NostrEvent } from 'nostr-tools'
import { Dispatch, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
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
  parentStuff?: NostrEvent | string
  open: boolean
  setOpen: Dispatch<boolean>
  openFrom?: string[]
  highlightedText?: string
}) {
  const { t } = useTranslation()
  const { isSmallScreen } = useScreenSize()
  const editorId = useId()
  const minimizingRef = useRef(false)
  const [minimized, setMinimized] = useState(false)

  useEffect(() => {
    const handleMinimizeEditor = (event: Event) => {
      const { editorId: minimizedEditorId } = (event as CustomEvent<{ editorId: string }>).detail
      if (minimizedEditorId !== editorId) {
        setMinimized(false)
      }
    }

    postEditor.addEventListener('minimizeEditor', handleMinimizeEditor)
    return () => postEditor.removeEventListener('minimizeEditor', handleMinimizeEditor)
  }, [editorId])

  useEffect(() => {
    if (open) {
      setMinimized(false)
    }
  }, [open])

  const handleClose = useCallback(() => {
    setMinimized(false)
    setOpen(false)
  }, [setOpen])

  const handleMinimize = useCallback(() => {
    minimizingRef.current = true
    setMinimized(true)
    postEditor.minimizeEditor(editorId)
    setOpen(false)
  }, [editorId, setOpen])

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      setOpen(nextOpen)
      if (nextOpen) {
        setMinimized(false)
      } else if (!minimizingRef.current) {
        setMinimized(false)
      }
      minimizingRef.current = false
    },
    [setOpen]
  )

  const minimizedLabel = highlightedText
    ? t('Create Highlight')
    : parentStuff
      ? t('Reply')
      : t('Compose')

  const content = useMemo(() => {
    return (
      <PostContent
        defaultContent={defaultContent}
        parentStuff={parentStuff}
        close={handleClose}
        onMinimize={handleMinimize}
        openFrom={openFrom}
        highlightedText={highlightedText}
      />
    )
  }, [defaultContent, parentStuff, handleClose, handleMinimize, openFrom, highlightedText])

  const minimizedButton = minimized && !open && (
    <Button
      className="fixed bottom-[calc(env(safe-area-inset-bottom)+4rem)] left-1/2 z-50 -translate-x-1/2 rounded-full px-4 shadow-lg sm:bottom-6"
      onClick={() => {
        setMinimized(false)
        setOpen(true)
      }}
    >
      <PencilLine />
      {minimizedLabel}
    </Button>
  )

  if (isSmallScreen) {
    return (
      <>
        {minimizedButton}
        <Sheet open={open} onOpenChange={handleOpenChange}>
          <SheetContent
            className="h-full w-full border-none p-0"
            side="bottom"
            hideClose
            onEscapeKeyDown={(e) => {
              if (postEditor.isSuggestionPopupOpen) {
                e.preventDefault()
                postEditor.closeSuggestionPopup()
              }
            }}
          >
            <ScrollArea className="h-full max-h-screen px-4">
              <div className="space-y-4 px-2 py-6">
                <SheetHeader>
                  <SheetTitle className="text-start">
                    {highlightedText ? t('Create Highlight') : <Title parentStuff={parentStuff} />}
                  </SheetTitle>
                  <SheetDescription className="hidden" />
                </SheetHeader>
                {content}
              </div>
            </ScrollArea>
          </SheetContent>
        </Sheet>
      </>
    )
  }

  return (
    <>
      {minimizedButton}
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent
          className="max-w-2xl p-0"
          withoutClose
          onEscapeKeyDown={(e) => {
            if (postEditor.isSuggestionPopupOpen) {
              e.preventDefault()
              postEditor.closeSuggestionPopup()
            }
          }}
        >
          <ScrollArea className="h-full max-h-screen px-4">
            <div className="space-y-4 px-2 py-6">
              <DialogHeader>
                <DialogTitle>
                  {highlightedText ? t('Create Highlight') : <Title parentStuff={parentStuff} />}
                </DialogTitle>
                <DialogDescription className="hidden" />
              </DialogHeader>
              {content}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  )
}
