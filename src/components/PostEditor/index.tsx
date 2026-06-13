import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Drawer, DrawerContent } from '@/components/ui/drawer'
import { ScrollArea } from '@/components/ui/scroll-area'
import { toNote } from '@/lib/link'
import { useSecondaryPage } from '@/PageManager'
import { useDraftBox } from '@/providers/DraftBoxProvider'
import { useNostr } from '@/providers/NostrProvider'
import { useScreenSize } from '@/providers/ScreenSizeProvider'
import postDraftService from '@/services/post-draft.service'
import postEditor from '@/services/post-editor.service'
import { TPostDraftUnsigned } from '@/types/post-draft'
import { Event } from 'nostr-tools'
import { Dispatch, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import DraftsButton from './DraftsButton'
import PostContent, { TPostContentHandle } from './PostContent'
import Title from './Title'

export default function PostEditor({
  defaultContent = '',
  parentStuff,
  open,
  setOpen,
  openFrom,
  highlightedText,
  initialDraft
}: {
  defaultContent?: string
  parentStuff?: Event | string
  open: boolean
  setOpen: Dispatch<boolean>
  openFrom?: string[]
  highlightedText?: string
  initialDraft?: TPostDraftUnsigned
}) {
  const { t } = useTranslation()
  const { isSmallScreen } = useScreenSize()
  const { pubkey } = useNostr()
  const { openDraftBox, startEditingDraft } = useDraftBox()
  const { push } = useSecondaryPage()
  const contentRef = useRef<TPostContentHandle>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  // When this editor is opened straight from the drafts box, the drafts drawer's
  // closing transition can fire a spurious outside-dismiss on the freshly-mounted
  // editor. Ignore close events in the first moments after mount.
  const mountedAtRef = useRef(Date.now())

  // When opening a reply/quote composer, resume an existing draft for the same
  // parent if one exists (unless an explicit draft was passed in).
  const resolvedInitialDraft = useMemo(() => {
    if (initialDraft) return initialDraft
    // Highlight composers share the source event as their parent; don't resume an
    // unrelated reply draft for that same event.
    if (!open || !pubkey || !parentStuff || highlightedText) return undefined
    return postDraftService.findDraftForParent(pubkey, parentStuff)
  }, [initialDraft, open, pubkey, parentStuff, highlightedText])
  const bypassConfirmRef = useRef(false)
  // What to run once the "save as draft?" question is resolved. Receives the
  // saved draft id when the user chose to save (undefined on discard).
  const pendingProceedRef = useRef<((savedId?: string) => void) | null>(null)

  const closeWithoutConfirm = () => {
    bypassConfirmRef.current = true
    setOpen(false)
  }

  // Shared "save as draft?" gate used both when closing the editor and when
  // jumping to the drafts box. Brand-new unsaved content prompts the user; an
  // already-persisted draft just saves silently; empty content proceeds.
  const runWithSaveGuard = (proceed: (savedId?: string) => void) => {
    const content = contentRef.current
    if (content?.isDirty() && !content.hasPersistedDraft()) {
      pendingProceedRef.current = proceed
      setConfirmOpen(true)
      return
    }
    if (content?.hasPersistedDraft()) {
      content.saveDraft().then((saved) => proceed(saved?.id))
      return
    }
    proceed(undefined)
  }

  const goToDraftBox = (savedId?: string) => {
    closeWithoutConfirm()
    openDraftBox('draft', () => {
      // Return to where we came from: the saved draft if any, else reopen this editor.
      if (savedId) {
        const d = postDraftService.get(savedId)
        if (d && d.status === 'draft') {
          startEditingDraft(d)
          return
        }
      }
      setOpen(true)
    })
  }

  const openDraftsFromEditor = () => {
    runWithSaveGuard(goToDraftBox)
  }

  const navigateToParent = (parentEvent: Event) => {
    runWithSaveGuard(() => {
      closeWithoutConfirm()
      push(toNote(parentEvent))
    })
  }

  const closeEditor = closeWithoutConfirm

  const handleOpenChange = (next: boolean) => {
    if (next) {
      setOpen(true)
      return
    }
    if (bypassConfirmRef.current) {
      bypassConfirmRef.current = false
      setOpen(false)
      return
    }
    // Swallow the spurious outside-dismiss that can fire right after opening from
    // the drafts box (stacked-dialog focus/outside-click race on mobile).
    if (Date.now() - mountedAtRef.current < 500) {
      return
    }
    runWithSaveGuard(() => closeWithoutConfirm())
  }

  const onConfirmSave = async () => {
    const saved = await contentRef.current?.saveDraft()
    setConfirmOpen(false)
    const proceed = pendingProceedRef.current
    pendingProceedRef.current = null
    proceed?.(saved?.id)
  }

  const onConfirmDiscard = () => {
    setConfirmOpen(false)
    const proceed = pendingProceedRef.current
    pendingProceedRef.current = null
    proceed?.(undefined)
  }

  const onConfirmCancel = () => {
    setConfirmOpen(false)
    pendingProceedRef.current = null
  }

  const effectiveParentStuff = useMemo<Event | string | undefined>(() => {
    if (resolvedInitialDraft?.parentEvent) return resolvedInitialDraft.parentEvent
    if (resolvedInitialDraft?.parentEventCoordinate)
      return resolvedInitialDraft.parentEventCoordinate
    return parentStuff
  }, [resolvedInitialDraft, parentStuff])

  const content = useMemo(() => {
    return (
      <PostContent
        key={resolvedInitialDraft?.id ?? 'new'}
        ref={contentRef}
        defaultContent={defaultContent}
        parentStuff={parentStuff}
        close={closeEditor}
        requestClose={() => setOpen(false)}
        onOpenDrafts={openDraftsFromEditor}
        onParentClick={navigateToParent}
        openFrom={openFrom}
        highlightedText={highlightedText}
        initialDraft={resolvedInitialDraft}
      />
    )
  }, [highlightedText, resolvedInitialDraft])

  return (
    <>
      {isSmallScreen ? (
        <Drawer open={open} onOpenChange={handleOpenChange}>
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
      ) : (
        <Dialog open={open} onOpenChange={handleOpenChange}>
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
                <div className="flex items-center justify-between gap-2">
                  <DialogTitle className="min-w-0 flex-1">
                    {highlightedText ? (
                      t('Create Highlight')
                    ) : (
                      <Title parentStuff={effectiveParentStuff} />
                    )}
                  </DialogTitle>
                  <DraftsButton onClick={openDraftsFromEditor} />
                </div>
                <DialogDescription className="hidden" />
              </DialogHeader>
              {content}
            </ScrollArea>
          </DialogContent>
        </Dialog>
      )}

      {isSmallScreen ? (
        <Drawer open={confirmOpen} onOpenChange={setConfirmOpen}>
          <DrawerContent title={t('Save as draft?')}>
            <div className="space-y-4 px-4 pb-2">
              <div className="space-y-1 text-center">
                <div className="text-base font-semibold">{t('Save as draft?')}</div>
                <div className="text-sm text-muted-foreground">
                  {t('Your changes will be saved to the drafts box.')}
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Button size="lg" className="w-full" onClick={onConfirmSave}>
                  {t('Save')}
                </Button>
                <Button size="lg" variant="secondary" className="w-full" onClick={onConfirmCancel}>
                  {t('Keep editing')}
                </Button>
                <Button
                  size="lg"
                  variant="destructive"
                  className="w-full"
                  onClick={onConfirmDiscard}
                >
                  {t('Discard')}
                </Button>
              </div>
            </div>
          </DrawerContent>
        </Drawer>
      ) : (
        <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('Save as draft?')}</AlertDialogTitle>
              <AlertDialogDescription>
                {t('Your changes will be saved to the drafts box.')}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={onConfirmCancel} className="sm:me-auto">
                {t('Keep editing')}
              </AlertDialogCancel>
              <AlertDialogAction
                variant="ghost"
                onClick={onConfirmDiscard}
                className="text-destructive hover:text-destructive"
              >
                {t('Discard')}
              </AlertDialogAction>
              <AlertDialogAction onClick={onConfirmSave}>{t('Save')}</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  )
}
