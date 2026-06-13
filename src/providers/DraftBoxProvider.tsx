import { formatError } from '@/lib/error'
import { useNostr } from '@/providers/NostrProvider'
import postDraftService from '@/services/post-draft.service'
import { TPostDraft, TPostDraftStatus } from '@/types/post-draft'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

type TDraftBoxContext = {
  open: boolean
  activeTab: TPostDraftStatus
  editingDraft: TPostDraft | undefined
  canGoBack: boolean
  openDraftBox: (tab?: TPostDraftStatus, onReturn?: () => void) => void
  closeDraftBox: () => void
  goBack: () => void
  startEditingDraft: (draft: TPostDraft) => void
  finishEditingDraft: () => void
}

const DraftBoxContext = createContext<TDraftBoxContext | undefined>(undefined)

// Slightly longer than the drawer/dialog close animation (~150ms).
const DRAFT_BOX_CLOSE_MS = 200

export function useDraftBox(): TDraftBoxContext {
  const ctx = useContext(DraftBoxContext)
  if (!ctx) throw new Error('useDraftBox must be used within DraftBoxProvider')
  return ctx
}

export function DraftBoxProvider({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation()
  const { pubkey } = useNostr()
  const [open, setOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<TPostDraftStatus>('draft')
  const [editingDraft, setEditingDraft] = useState<TPostDraft | undefined>(undefined)
  const [canGoBack, setCanGoBack] = useState(false)
  const returnRef = useRef<(() => void) | null>(null)
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearReturn = useCallback(() => {
    returnRef.current = null
    setCanGoBack(false)
  }, [])

  const openDraftBox = useCallback((tab: TPostDraftStatus = 'draft', onReturn?: () => void) => {
    // Cancel any pending deferred action so a fast reopen can't fire a stale one.
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
    setActiveTab(tab)
    returnRef.current = onReturn ?? null
    setCanGoBack(!!onReturn)
    setOpen(true)
  }, [])

  const closeDraftBox = useCallback(() => {
    setOpen(false)
    clearReturn()
  }, [clearReturn])

  // Close the drafts drawer, then run the follow-up AFTER its close animation.
  // Mounting the editor while the drafts drawer is still animating out makes the
  // two stacked Radix dialogs fight over focus/outside-click, and the editor
  // dismisses itself immediately on mobile.
  const closeBoxThen = useCallback(
    (action: () => void) => {
      setOpen(false)
      clearReturn()
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
      closeTimerRef.current = setTimeout(() => {
        closeTimerRef.current = null
        action()
      }, DRAFT_BOX_CLOSE_MS)
    },
    [clearReturn]
  )

  const startEditingDraft = useCallback(
    (draft: TPostDraft) => {
      closeBoxThen(() => setEditingDraft(draft))
    },
    [closeBoxThen]
  )

  const goBack = useCallback(() => {
    const cb = returnRef.current
    closeBoxThen(() => cb?.())
  }, [closeBoxThen])

  const finishEditingDraft = useCallback(() => {
    setEditingDraft(undefined)
  }, [])

  // Resume interrupted publishes once the account (and its signer, needed for
  // relay AUTH) is ready. Scoped to this account so we never re-broadcast a
  // different account's pending with the wrong identity.
  useEffect(() => {
    if (pubkey) {
      postDraftService.resumePending(pubkey)
    }
  }, [pubkey])

  useEffect(() => {
    const onStart = (e: Event) => {
      const { promise } = (e as CustomEvent).detail as { id: string; promise: Promise<unknown> }
      toast.promise(promise, {
        loading: t('Sending...'),
        success: t('Post successful'),
        error: (err) => ({
          message: `${t('Failed to post')}: ${formatError(err).join('; ')}`,
          duration: Infinity,
          action: {
            label: t('Open drafts'),
            onClick: () => openDraftBox('failed')
          }
        })
      })
    }
    postDraftService.addEventListener('publish-start', onStart)
    return () => {
      postDraftService.removeEventListener('publish-start', onStart)
    }
  }, [openDraftBox, t])

  const value = useMemo(
    () => ({
      open,
      activeTab,
      editingDraft,
      canGoBack,
      openDraftBox,
      closeDraftBox,
      goBack,
      startEditingDraft,
      finishEditingDraft
    }),
    [
      open,
      activeTab,
      editingDraft,
      canGoBack,
      openDraftBox,
      closeDraftBox,
      goBack,
      startEditingDraft,
      finishEditingDraft
    ]
  )

  return <DraftBoxContext.Provider value={value}>{children}</DraftBoxContext.Provider>
}
