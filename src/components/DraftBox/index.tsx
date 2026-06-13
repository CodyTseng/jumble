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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { buildPreviewEvent } from '@/lib/post-draft'
import { cn } from '@/lib/utils'
import { useDraftBox } from '@/providers/DraftBoxProvider'
import { useNostr } from '@/providers/NostrProvider'
import { useScreenSize } from '@/providers/ScreenSizeProvider'
import postDraftService, { useDraftCounts, useDrafts } from '@/services/post-draft.service'
import {
  TPostDraft,
  TPostDraftSigned,
  TPostDraftStatus,
  TPostDraftUnsigned
} from '@/types/post-draft'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import { Event } from 'nostr-tools'
import { ArrowLeft, RefreshCw, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import ContentPreview from '../ContentPreview'
import Note from '../Note'
import { SimpleUsername } from '../Username'

dayjs.extend(relativeTime)

const triggerClass =
  'h-8 rounded-md bg-transparent px-3 text-sm text-muted-foreground shadow-none hover:text-foreground data-[state=active]:bg-muted data-[state=active]:text-foreground data-[state=active]:shadow-none'

export default function DraftBox() {
  const { t } = useTranslation()
  const { open, activeTab, canGoBack, closeDraftBox, goBack, startEditingDraft } = useDraftBox()
  const { pubkey } = useNostr()
  const { isSmallScreen } = useScreenSize()
  const drafts = useDrafts(pubkey ?? undefined)
  const counts = useDraftCounts(pubkey ?? undefined)
  const [tab, setTab] = useState<TPostDraftStatus>(activeTab)

  useEffect(() => {
    if (open) setTab(activeTab)
  }, [open, activeTab])

  const filtered = useMemo(() => drafts.filter((d) => d.status === tab), [drafts, tab])

  const backButton = canGoBack ? (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="-ms-2 size-8 shrink-0"
      title={t('Back')}
      onClick={goBack}
    >
      <ArrowLeft className="rtl:-scale-x-100" />
    </Button>
  ) : null

  const body = (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="px-4 pb-2 sm:px-6">
        <Tabs value={tab} onValueChange={(v) => setTab(v as TPostDraftStatus)}>
          <TabsList className="h-auto gap-1 bg-transparent p-0">
            <TabsTrigger value="draft" className={triggerClass}>
              {t('Drafts')}
              {counts.draft > 0 && (
                <span className="ms-1.5 text-xs tabular-nums opacity-70">{counts.draft}</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="failed" className={triggerClass}>
              {t('Failed')}
              {counts.failed > 0 && (
                <span className="ms-1.5 text-xs tabular-nums opacity-70">{counts.failed}</span>
              )}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      <div className="h-px bg-border" />
      <ScrollArea className="min-h-0 flex-1">
        {filtered.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">
            {t('No drafts yet')}
          </div>
        ) : (
          <div className="divide-y border-b">
            {filtered.map((draft) => (
              <DraftItem key={draft.id} draft={draft} onEdit={() => startEditingDraft(draft)} />
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  )

  if (isSmallScreen) {
    return (
      <Drawer open={open} onOpenChange={(o) => !o && closeDraftBox()}>
        <DrawerContent
          className="flex h-[85dvh] max-h-[85dvh] flex-col overflow-hidden"
          title={t('Drafts')}
        >
          <div className="flex items-center gap-2 px-5 pb-2 pt-4">
            {backButton}
            <span className="text-lg font-semibold">{t('Drafts')}</span>
          </div>
          {body}
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && closeDraftBox()}>
      <DialogContent className="flex h-[600px] max-h-[85vh] max-w-2xl flex-col gap-0 p-0 sm:rounded-2xl">
        <DialogHeader className="px-6 pb-3 pt-6">
          <div className="flex items-center gap-2">
            {backButton}
            <DialogTitle>{t('Drafts')}</DialogTitle>
          </div>
          <DialogDescription className="hidden" />
        </DialogHeader>
        {body}
      </DialogContent>
    </Dialog>
  )
}

function DraftItem({ draft, onEdit }: { draft: TPostDraft; onEdit: () => void }) {
  const { t } = useTranslation()
  const [busy, setBusy] = useState(false)

  const handleDelete = async () => {
    await postDraftService.delete(draft.id)
  }

  const handleRetry = async () => {
    if (draft.status !== 'failed') return
    setBusy(true)
    try {
      await postDraftService.retry(draft.id)
    } catch (err) {
      toast.error(String(err))
    } finally {
      setBusy(false)
    }
  }

  if (draft.status === 'failed') {
    const signed = draft as TPostDraftSigned
    return (
      <div className="px-4 py-3 sm:px-6">
        <div className="text-sm text-muted-foreground">{dayjs(draft.updatedAt).fromNow()}</div>
        <div className="pointer-events-none mt-1">
          <Note event={signed.signedEvent} showFull hideHeader />
        </div>
        <div className="mt-2 flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="ghost-destructive"
            onClick={(e) => {
              e.stopPropagation()
              handleDelete()
            }}
          >
            <Trash2 />
            {t('Delete')}
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={busy}
            onClick={(e) => {
              e.stopPropagation()
              handleRetry()
            }}
          >
            <RefreshCw className={cn(busy && 'animate-spin')} />
            {t('Retry')}
          </Button>
        </div>
      </div>
    )
  }

  const previewEvent = getPreviewEvent(draft)
  const parentEvent = getParentEvent(draft)

  return (
    <div
      className="group flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40 sm:px-6"
      onClick={onEdit}
      role="button"
    >
      <div className="min-w-0 flex-1">
        <div className="text-sm text-muted-foreground">{dayjs(draft.updatedAt).fromNow()}</div>

        {parentEvent ? (
          <div className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
            <span className="shrink-0">{t('Reply to')}</span>
            <SimpleUsername
              userId={parentEvent.pubkey}
              showAt
              className="shrink-0 font-medium text-foreground"
            />
            <span className="shrink-0">·</span>
            <ContentPreview event={parentEvent} className="min-w-0 truncate" />
          </div>
        ) : (
          <div className="mt-0.5">
            <DraftContextLabel draft={draft} />
          </div>
        )}

        {previewEvent ? (
          <ContentPreview
            event={previewEvent}
            className="mt-1 line-clamp-2 break-words text-base"
          />
        ) : (
          <div className="mt-1 text-base italic text-muted-foreground">{t('Empty')}</div>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-0.5 self-center">
        <Button
          type="button"
          variant="ghost-destructive"
          size="icon"
          title={t('Delete')}
          onClick={(e) => {
            e.stopPropagation()
            handleDelete()
          }}
        >
          <Trash2 />
        </Button>
      </div>
    </div>
  )
}

function DraftContextLabel({ draft }: { draft: TPostDraft }) {
  const { t } = useTranslation()
  const highlightedText =
    draft.status === 'draft'
      ? (draft as TPostDraftUnsigned).highlightedText
      : (draft as TPostDraftSigned).highlightedText
  const coordinate =
    draft.status === 'draft'
      ? (draft as TPostDraftUnsigned).parentEventCoordinate
      : (draft as TPostDraftSigned).parentEventCoordinate
  if (highlightedText)
    return <div className="text-sm text-muted-foreground">{t('Highlight')}</div>
  if (coordinate) return <div className="text-sm text-muted-foreground">{t('Reply')}</div>
  return <div className="text-sm text-muted-foreground">{t('Note')}</div>
}

function getParentEvent(draft: TPostDraft): Event | undefined {
  return draft.status === 'draft'
    ? (draft as TPostDraftUnsigned).parentEvent
    : (draft as TPostDraftSigned).parentEvent
}

function getPreviewEvent(draft: TPostDraft): Event | undefined {
  if (draft.status !== 'draft') {
    return (draft as TPostDraftSigned).signedEvent
  }
  const u = draft as TPostDraftUnsigned
  return u.previewEvent ?? buildPreviewEvent(u)
}
