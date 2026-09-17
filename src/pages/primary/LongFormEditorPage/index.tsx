import LongFormArticle from '@/components/NoteContent/LongFormArticle'
import Uploader from '@/components/PostEditor/Uploader'
import ClickableCard from '@/components/ClickableCard'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Drawer, DrawerContent } from '@/components/ui/drawer'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Textarea } from '@/components/ui/textarea'
import PrimaryPageLayout from '@/layouts/PrimaryPageLayout'
import SecondaryPageLayout from '@/layouts/SecondaryPageLayout'
import { createLongFormArticleDraftEvent } from '@/lib/draft-event'
import { formatError } from '@/lib/error'
import { createFakeEvent } from '@/lib/event'
import { estimateReadingMinutes } from '@/lib/markdown'
import { randomString } from '@/lib/random'
import { autoResizeTextarea, scrollTextareaCaretIntoView } from '@/lib/textarea'
import { cn } from '@/lib/utils'
import { usePrimaryPage, useSecondaryPage } from '@/PageManager'
import { useNostr } from '@/providers/NostrProvider'
import { usePageActive } from '@/providers/PageActiveProvider'
import { useScreenSize } from '@/providers/ScreenSizeProvider'
import { useUserPreferences } from '@/providers/UserPreferencesProvider'
import storage from '@/services/local-storage.service'
import longFormDraftService from '@/services/long-form-draft.service'
import { TLongFormDraft } from '@/types/long-form-draft'
import dayjs from 'dayjs'
import {
  Bold,
  Check,
  Code2,
  Eye,
  FilePenLine,
  Files,
  Heading2,
  Heading3,
  Heading4,
  ImagePlus,
  Italic,
  Link,
  List,
  ListOrdered,
  ListTodo,
  Loader,
  PencilLine,
  Plus,
  Quote,
  Save,
  Trash2,
  Upload,
  X
} from 'lucide-react'
import { Event, kinds } from 'nostr-tools'
import {
  ChangeEvent,
  forwardRef,
  RefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import useTextareaMention from './useTextareaMention'
import PublishSettings from './PublishSettings'
import useArticleMentions from './useArticleMentions'
import usePreviewScrollSync from './usePreviewScrollSync'
import MarkdownTextarea from './MarkdownTextarea'
import usePreviewTabPosition from './usePreviewTabPosition'

type TEditorTab = 'edit' | 'preview'
type TSaveState = 'saved' | 'saving'

function createEmptyDraft(): TLongFormDraft {
  const now = Date.now()
  return {
    identifier: randomString(16),
    title: '',
    summary: '',
    image: '',
    tags: [],
    content: '',
    createdAt: now,
    updatedAt: now
  }
}

function hasDraftContent(draft: TLongFormDraft) {
  return Boolean(
    draft.title.trim() ||
      draft.summary.trim() ||
      draft.image.trim() ||
      draft.tags.length ||
      draft.content.trim()
  )
}

function useAutoResizeTextarea(ref: RefObject<HTMLTextAreaElement | null>, value: string) {
  // Layout effect: resize before paint, otherwise the textarea renders one
  // frame at its stale height on every keystroke (visible as jitter).
  useLayoutEffect(() => {
    const textarea = ref.current
    if (!textarea) return
    autoResizeTextarea(textarea)
    if (document.activeElement === textarea) {
      scrollTextareaCaretIntoView(textarea)
    }
  }, [ref, value])
}

const LongFormEditorPage = forwardRef(function LongFormEditorPage(
  { editEvent, index }: { editEvent?: Event; index?: number },
  ref
) {
  const { t } = useTranslation()
  const { current, display } = usePrimaryPage()
  const { pop, currentIndex } = useSecondaryPage()
  const { pubkey, publish } = useNostr()
  const isSecondaryEditor = index !== undefined
  const active = isSecondaryEditor
    ? currentIndex === index
    : current === 'longFormEditor' && display
  const { isSmallScreen, isLargeScreen } = useScreenSize()
  const [draft, setDraft] = useState<TLongFormDraft>(() => createEmptyDraft())
  const isProtectedEvent =
    draft.isProtectedEvent ?? draft.originalTags?.some(([name]) => name === '-') ?? false
  const isNsfw =
    draft.isNsfw ?? draft.originalTags?.some(([name]) => name === 'content-warning') ?? false
  const [drafts, setDrafts] = useState<TLongFormDraft[]>([])
  const [draftPickerOpen, setDraftPickerOpen] = useState(false)
  const [loadedPubkey, setLoadedPubkey] = useState<string>()
  const [saveState, setSaveState] = useState<TSaveState>('saved')
  const [publishing, setPublishing] = useState(false)
  const [publishSettingsOpen, setPublishSettingsOpen] = useState(false)
  const articleMentions = useArticleMentions(draft, setDraft, pubkey ?? undefined)
  const { mentions, loading: mentionsLoading } = articleMentions
  const [tab, setTab] = useState<TEditorTab>('edit')
  const [tagInput, setTagInput] = useState('')
  const [uploadProgress, setUploadProgress] = useState<number>()
  const [coverUploadProgress, setCoverUploadProgress] = useState<number>()
  const titleRef = useRef<HTMLTextAreaElement>(null)
  const summaryRef = useRef<HTMLTextAreaElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const singlePreviewRef = useRef<HTMLElement>(null)
  const previewIdRef = useRef('0'.repeat(64))
  const handledEditEventRef = useRef<Event>()
  const pendingDraftRef = useRef<{ pubkey: string; draft: TLongFormDraft }>()
  const publishedDraftRef = useRef<string>()
  pendingDraftRef.current = pubkey && loadedPubkey === pubkey ? { pubkey, draft } : undefined
  useLayoutEffect(
    () => () => {
      // Layout changes remount the editor. Flush before the replacement reads
      // storage, including input still inside the autosave debounce window.
      const pending = pendingDraftRef.current
      if (!pending || pending.draft.identifier === publishedDraftRef.current) return
      if (hasDraftContent(pending.draft)) longFormDraftService.save(pending.pubkey, pending.draft)
      else longFormDraftService.delete(pending.pubkey, pending.draft.identifier)
    },
    []
  )
  const { enableSingleColumnLayout } = useUserPreferences()
  const showSecondScreenPreview = isLargeScreen && !enableSingleColumnLayout
  const { changeTab: changeEditorTab, prepareTabChange } = usePreviewTabPosition(
    textareaRef,
    singlePreviewRef,
    tab,
    setTab,
    active && !showSecondScreenPreview,
    enableSingleColumnLayout || isSmallScreen
  )
  const previewScrollRef = usePreviewScrollSync(
    textareaRef,
    draft.content,
    active && showSecondScreenPreview
  )
  const EditorLayout = isSecondaryEditor ? SecondaryPageLayout : PrimaryPageLayout

  useEffect(() => {
    if (!pubkey) {
      setLoadedPubkey(undefined)
      setDrafts([])
      setDraft(createEmptyDraft())
      return
    }
    const savedDrafts = longFormDraftService.list(pubkey)
    setDrafts(savedDrafts)
    setDraft(savedDrafts[0] ?? createEmptyDraft())
    setLoadedPubkey(pubkey)
    setSaveState('saved')
  }, [pubkey])

  useEffect(() => {
    if (
      !pubkey ||
      loadedPubkey !== pubkey ||
      !editEvent ||
      editEvent.pubkey !== pubkey ||
      editEvent.kind !== kinds.LongFormArticle ||
      handledEditEventRef.current === editEvent
    )
      return
    handledEditEventRef.current = editEvent
    if (hasDraftContent(draft)) longFormDraftService.save(pubkey, draft)
    setDraft(longFormDraftService.startEditing(editEvent))
    setDrafts(longFormDraftService.list(pubkey))
    setTagInput('')
    setTab('edit')
    setSaveState('saved')
    setDraftPickerOpen(false)
  }, [editEvent, pubkey, loadedPubkey, draft])

  useEffect(() => {
    if (!pubkey || loadedPubkey !== pubkey) return
    setSaveState('saving')
    const timeout = window.setTimeout(() => {
      if (hasDraftContent(draft)) {
        longFormDraftService.save(pubkey, { ...draft, updatedAt: Date.now() })
        setDrafts(longFormDraftService.list(pubkey))
      } else if (longFormDraftService.get(pubkey, draft.identifier) !== undefined) {
        // Everything was erased — drop the draft instead of keeping an empty shell
        longFormDraftService.delete(pubkey, draft.identifier)
        setDrafts(longFormDraftService.list(pubkey))
      }
      setSaveState('saved')
    }, 500)
    return () => window.clearTimeout(timeout)
  }, [draft, loadedPubkey, pubkey])

  useAutoResizeTextarea(titleRef, draft.title)
  useAutoResizeTextarea(summaryRef, draft.summary)

  const updateDraft = useCallback((patch: Partial<TLongFormDraft>) => {
    setDraft((current) => ({ ...current, ...patch, updatedAt: Date.now() }))
  }, [])

  const { popup: mentionPopup, ...mentionHandlers } = useTextareaMention({
    textareaRef,
    value: draft.content,
    onChange: (content) => updateDraft({ content }),
    enabled: active && !draftPickerOpen && (showSecondScreenPreview || tab === 'edit')
  })

  const handleTextareaChange = useCallback(
    (key: 'title' | 'summary' | 'content') => (event: ChangeEvent<HTMLTextAreaElement>) => {
      updateDraft({ [key]: event.target.value })
    },
    [updateDraft]
  )

  const persistCurrentDraft = useCallback(() => {
    if (!pubkey) return []
    if (hasDraftContent(draft)) {
      longFormDraftService.save(pubkey, { ...draft, updatedAt: Date.now() })
    } else if (longFormDraftService.get(pubkey, draft.identifier) !== undefined) {
      longFormDraftService.delete(pubkey, draft.identifier)
    }
    const savedDrafts = longFormDraftService.list(pubkey)
    setDrafts(savedDrafts)
    return savedDrafts
  }, [draft, pubkey])

  const openDraftPicker = useCallback(() => {
    persistCurrentDraft()
    setDraftPickerOpen(true)
  }, [persistCurrentDraft])

  const startNewDraft = useCallback(() => {
    persistCurrentDraft()
    setDraft(createEmptyDraft())
    setTagInput('')
    setTab('edit')
    setSaveState('saved')
    setDraftPickerOpen(false)
  }, [persistCurrentDraft])

  const selectDraft = useCallback(
    (selectedDraft: TLongFormDraft) => {
      if (selectedDraft.identifier !== draft.identifier) persistCurrentDraft()
      setDraft(selectedDraft)
      setTagInput('')
      setTab('edit')
      setSaveState('saved')
      setDraftPickerOpen(false)
    },
    [draft.identifier, persistCurrentDraft]
  )

  const deleteDraft = useCallback(
    (identifier: string) => {
      if (!pubkey) return
      longFormDraftService.delete(pubkey, identifier)
      const remainingDrafts = longFormDraftService.list(pubkey)
      setDrafts(remainingDrafts)
      if (draft.identifier === identifier) {
        setDraft(remainingDrafts[0] ?? createEmptyDraft())
        setTagInput('')
        setTab('edit')
        setSaveState('saved')
      }
    },
    [draft.identifier, pubkey]
  )

  const addTags = useCallback(() => {
    const additions = tagInput
      .split(/[#,，\s]+/)
      .map((tag) => tag.trim().replace(/^#/, '').toLocaleLowerCase())
      .filter(Boolean)
    if (!additions.length) return
    updateDraft({ tags: Array.from(new Set([...draft.tags, ...additions])).slice(0, 6) })
    setTagInput('')
  }, [draft.tags, tagInput, updateDraft])

  const replaceSelection = useCallback(
    (before: string, after = '') => {
      const textarea = textareaRef.current
      if (!textarea) return
      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      const selection = draft.content.slice(start, end)
      const replacement = `${before}${selection}${after}`
      updateDraft({
        content: draft.content.slice(0, start) + replacement + draft.content.slice(end)
      })
      requestAnimationFrame(() => {
        textarea.focus()
        const selectionStart = start + before.length
        textarea.setSelectionRange(selectionStart, selectionStart + selection.length)
      })
    },
    [draft.content, updateDraft]
  )

  const prefixSelection = useCallback(
    (prefix: string) => {
      const textarea = textareaRef.current
      if (!textarea) return
      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      const lineStart = draft.content.lastIndexOf('\n', Math.max(0, start - 1)) + 1
      const selected = draft.content.slice(lineStart, end)
      const replacement = selected
        .split('\n')
        .map((line) => `${prefix}${line}`)
        .join('\n')
      updateDraft({
        content: draft.content.slice(0, lineStart) + replacement + draft.content.slice(end)
      })
      requestAnimationFrame(() => {
        textarea.focus()
        if (start === end) {
          // No selection: keep the cursor where it was, shifted by the prefix
          const cursor = end + prefix.length
          textarea.setSelectionRange(cursor, cursor)
        } else {
          textarea.setSelectionRange(lineStart, lineStart + replacement.length)
        }
      })
    },
    [draft.content, updateDraft]
  )

  const insertImage = useCallback((url: string, alt = '') => {
    const textarea = textareaRef.current
    if (!textarea) return
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const markdown = `![${alt}](${url})`
    let cursor = 0
    // Compute from the latest content: the upload finishes asynchronously and
    // the user may have kept typing while it was in flight.
    setDraft((current) => {
      const content = current.content
      const clampedStart = Math.min(start, content.length)
      const clampedEnd = Math.min(Math.max(end, clampedStart), content.length)
      const before = content.slice(0, clampedStart)
      const after = content.slice(clampedEnd)
      const prefix =
        before === '' || before.endsWith('\n\n') ? '' : before.endsWith('\n') ? '\n' : '\n\n'
      const suffix = after === '' || after.startsWith('\n') ? '' : '\n'
      const inserted = `${prefix}${markdown}${suffix}`
      cursor = before.length + inserted.length
      return { ...current, content: before + inserted + after, updatedAt: Date.now() }
    })
    requestAnimationFrame(() => {
      textarea.focus()
      textarea.setSelectionRange(cursor, cursor)
    })
  }, [])

  const publishArticle = async () => {
    if (!pubkey || publishing || mentionsLoading) return
    if (isProtectedEvent && !draft.additionalRelayUrls?.length) return
    if (!draft.title.trim()) {
      toast.error(t('Please add a title'))
      return
    }
    if (!draft.content.trim()) {
      toast.error(t('Please write some content'))
      return
    }

    setPublishing(true)
    try {
      longFormDraftService.save(pubkey, draft)
      await publish(
        createLongFormArticleDraftEvent({
          identifier: draft.identifier,
          title: draft.title,
          summary: draft.summary,
          image: draft.image,
          tags: draft.tags,
          content: draft.content,
          mentions,
          publishedAt: draft.publishedAt,
          originalTags: draft.originalTags,
          addClientTag: draft.addClientTag ?? storage.getAddClientTag(),
          isNsfw,
          protectedEvent: isProtectedEvent
        }),
        {
          minPow: draft.minPow ?? storage.getDefaultMinPow() ?? 0,
          specifiedRelayUrls: isProtectedEvent ? draft.additionalRelayUrls : undefined,
          additionalRelayUrls: draft.additionalRelayUrls ?? []
        }
      )
      publishedDraftRef.current = draft.identifier
      longFormDraftService.delete(pubkey, draft.identifier)
      const remainingDrafts = longFormDraftService.list(pubkey)
      setDrafts(remainingDrafts)
      setDraft(remainingDrafts[0] ?? createEmptyDraft())
      setPublishSettingsOpen(false)
      toast.success(t('Article published'))
      if (isSecondaryEditor) pop()
    } catch (error) {
      formatError(error).forEach((message) => {
        toast.error(`${t('Failed to publish article')}: ${message}`, { duration: 10_000 })
      })
    } finally {
      setPublishing(false)
    }
  }

  const previewEvent = useMemo<Event>(() => {
    const event = createLongFormArticleDraftEvent({
      identifier: draft.identifier,
      title: draft.title.trim() || t('Untitled article'),
      summary: draft.summary,
      image: draft.image,
      tags: draft.tags,
      content: draft.content || t('Your article preview will appear here.'),
      publishedAt: draft.publishedAt ?? Math.floor(draft.createdAt / 1000),
      originalTags: draft.originalTags,
      mentions,
      addClientTag: draft.addClientTag ?? storage.getAddClientTag(),
      isNsfw,
      protectedEvent: isProtectedEvent
    })
    return createFakeEvent({
      ...event,
      id: previewIdRef.current,
      pubkey: pubkey ?? ''
    })
  }, [draft, pubkey, t, isNsfw, isProtectedEvent, mentions])

  const controls = (
    <div className="flex items-center gap-2 pe-1 sm:pe-2">
      <div className="text-muted-foreground hidden items-center gap-1 text-xs sm:flex">
        {saveState === 'saving' ? (
          <Loader className="size-3 animate-spin" />
        ) : (
          <Check className="size-3" />
        )}
        {saveState === 'saving' ? t('Saving...') : t('Draft saved')}
      </div>
      {!editEvent && (
        <Button
          type="button"
          variant="ghost"
          size={isSmallScreen ? 'icon' : 'sm'}
          className="shrink-0 rounded-full"
          title={t('Drafts')}
          onClick={openDraftPicker}
        >
          <Files className="size-4" />
          {!isSmallScreen && (
            <span>
              {t('Drafts')}
              {drafts.length > 0 && ` (${drafts.length})`}
            </span>
          )}
        </Button>
      )}
      {pubkey && (
        <PublishSettings
          key={`${pubkey}:${draft.identifier}:${draft.sourceEventId ?? ''}`}
          draft={draft}
          setDraft={setDraft}
          publishing={publishing}
          editEvent={editEvent}
          articleMentions={articleMentions}
          open={publishSettingsOpen}
          onOpenChange={setPublishSettingsOpen}
          onPublish={publishArticle}
          mentionsLoading={mentionsLoading}
        />
      )}
      <Button
        size="sm"
        className="rounded-full px-4 font-semibold"
        disabled={publishing || !draft.title.trim() || !draft.content.trim()}
        onClick={() => setPublishSettingsOpen(true)}
      >
        {publishing ? <Loader className="animate-spin" /> : t('Publish')}
      </Button>
    </div>
  )

  const preview = (
    <div className="pointer-events-none mx-auto max-w-3xl select-text">
      <LongFormArticle event={previewEvent} sourceLines />
    </div>
  )

  const editor = (
    <EditorLayout
      ref={ref}
      index={index}
      forceScrollArea={showSecondScreenPreview}
      pageName="longFormEditor"
      title={draft.publishedAt !== undefined ? t('Edit') : t('Write article')}
      icon={<FilePenLine />}
      controls={controls}
      sideWidth="8rem"
    >
      <div className="w-full">
        {!showSecondScreenPreview && (
          <div className="bg-background/95 sticky top-12 z-20 flex border-b px-3 py-2 backdrop-blur-sm">
            <div className="bg-muted flex rounded-lg p-1">
              <Button
                variant="ghost"
                size="sm"
                className={cn('h-8 gap-1.5 px-3', tab === 'edit' && 'bg-background shadow-sm')}
                onPointerDown={() => prepareTabChange('edit')}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => changeEditorTab('edit')}
              >
                <PencilLine className="size-4" />
                {t('Edit')}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className={cn('h-8 gap-1.5 px-3', tab === 'preview' && 'bg-background shadow-sm')}
                onPointerDown={() => prepareTabChange('preview')}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => changeEditorTab('preview')}
              >
                <Eye className="size-4" />
                {t('Preview')}
              </Button>
            </div>
            <div className="text-muted-foreground ms-auto flex items-center gap-1 text-xs sm:hidden">
              {saveState === 'saving' ? (
                <Loader className="size-3 animate-spin" />
              ) : (
                <Save className="size-3" />
              )}
              {saveState === 'saving' ? t('Saving...') : t('Saved')}
            </div>
          </div>
        )}

        <section
          className={cn(
            'min-w-0 cursor-text px-3 pt-3 pb-8 sm:px-4 sm:pt-4',
            !showSecondScreenPreview && tab !== 'edit' && 'hidden'
          )}
          onClick={(e) => {
            // Position the caret without native focus scrolling away from the
            // blank area the user just chose. Typing will resume caret following.
            if (e.target !== e.currentTarget) return
            const textarea = textareaRef.current
            if (!textarea) return
            const end = textarea.value.length
            textarea.setSelectionRange(end, end)
            textarea.focus({ preventScroll: true })
          }}
        >
          <div className="space-y-4 sm:space-y-5">
            <textarea
              ref={titleRef}
              dir="auto"
              value={draft.title}
              rows={1}
              maxLength={180}
              placeholder={t('Article title')}
              aria-label={t('Article title')}
              className="placeholder:text-muted-foreground/60 block min-h-0 w-full resize-none overflow-hidden border-0 bg-transparent p-0 text-[2.5rem] leading-[1.08] font-bold tracking-tight placeholder:font-bold focus:outline-none sm:text-5xl"
              onChange={handleTextareaChange('title')}
            />

            <div className="space-y-1.5">
              <Label htmlFor="article-summary" className="text-muted-foreground text-sm">
                {t('Summary')}
              </Label>
              <Textarea
                ref={summaryRef}
                id="article-summary"
                dir="auto"
                value={draft.summary}
                maxLength={500}
                rows={2}
                placeholder={t('A short introduction shown before the article (optional)')}
                className="bg-muted/35 min-h-20 resize-none overflow-hidden border-0 shadow-none focus-visible:ring-1"
                onChange={handleTextareaChange('summary')}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-muted-foreground text-sm font-medium">
                    {t('Cover image')}
                  </div>
                  <div className="text-muted-foreground text-xs">
                    {t('A wide image works best (optional)')}
                  </div>
                </div>
                <Uploader
                  multiple={false}
                  accept="image/*"
                  onUploadSuccess={({ url }) => updateDraft({ image: url })}
                  onUploadStart={() => setCoverUploadProgress(0)}
                  onProgress={(_, progress) => setCoverUploadProgress(progress)}
                  onUploadEnd={() => setCoverUploadProgress(undefined)}
                >
                  <Button variant="secondary" size="sm" className="gap-2">
                    {coverUploadProgress === undefined ? (
                      <Upload className="size-4" />
                    ) : (
                      <Loader className="size-4 animate-spin" />
                    )}
                    {t('Upload')}
                  </Button>
                </Uploader>
              </div>
              {draft.image && (
                <div className="bg-muted relative overflow-hidden rounded-lg border">
                  <img src={draft.image} alt="" className="aspect-3/1 w-full object-cover" />
                  <Button
                    variant="secondary"
                    size="icon"
                    className="absolute top-2 right-2 size-8 rounded-full"
                    onClick={() => updateDraft({ image: '' })}
                    title={t('Remove')}
                  >
                    <X className="size-4" />
                  </Button>
                </div>
              )}
              <Input
                value={draft.image}
                placeholder="https://..."
                aria-label={t('Cover image URL')}
                className="bg-muted/35 border-0 shadow-none focus-visible:ring-1"
                onChange={(event) => updateDraft({ image: event.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="article-tags" className="text-muted-foreground text-sm">
                {t('Topics')}
              </Label>
              <div className="flex flex-wrap gap-2">
                {draft.tags.map((tag) => (
                  <button
                    type="button"
                    key={tag}
                    dir="auto"
                    className="bg-muted text-muted-foreground hover:text-foreground flex max-w-44 items-center gap-1 rounded-full px-3 py-1 text-sm"
                    onClick={() => updateDraft({ tags: draft.tags.filter((item) => item !== tag) })}
                  >
                    <span className="truncate">#{tag}</span>
                    <X className="size-3 shrink-0" />
                  </button>
                ))}
              </div>
              {draft.tags.length < 6 && (
                <Input
                  id="article-tags"
                  dir="auto"
                  value={tagInput}
                  placeholder={t('Add up to 6 topics, then press Enter')}
                  className="bg-muted/35 border-0 shadow-none focus-visible:ring-1"
                  onChange={(event) => setTagInput(event.target.value)}
                  onBlur={addTags}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ',') {
                      event.preventDefault()
                      addTags()
                    }
                  }}
                />
              )}
            </div>

            <div className="space-y-1.5">
              <div className="flex items-end justify-between gap-3">
                <Label htmlFor="article-content" className="text-muted-foreground text-sm">
                  {t('Article')}
                </Label>
                <div className="text-muted-foreground text-xs">
                  {draft.content.trim() ? draft.content.trim().split(/\s+/u).length : 0}{' '}
                  {t('words')} ·{' '}
                  {t('{{count}} min read', {
                    count: estimateReadingMinutes(draft.content)
                  })}
                </div>
              </div>
              <MarkdownToolbar
                showEditorTabs={!showSecondScreenPreview}
                onWrap={replaceSelection}
                onPrefix={prefixSelection}
                onImageUpload={(url, name) => insertImage(url, name)}
                uploadProgress={uploadProgress}
                setUploadProgress={setUploadProgress}
              />
              <MarkdownTextarea
                ref={textareaRef}
                id="article-content"
                {...mentionHandlers}
                dir="auto"
                value={draft.content}
                placeholder={t('Start writing in Markdown...')}
                className="min-h-[50vh] resize-none overflow-hidden rounded-none border-0 bg-transparent px-1 py-2 font-mono text-base leading-7 shadow-none focus-visible:ring-0 sm:min-h-[60vh]"
                onChange={handleTextareaChange('content')}
              />
              {mentionPopup}
            </div>
          </div>
        </section>

        <section
          ref={singlePreviewRef}
          className={cn(
            'min-w-0 px-3 py-4 sm:px-4 sm:py-5',
            showSecondScreenPreview || tab !== 'preview' ? 'hidden' : 'block'
          )}
        >
          {preview}
        </section>
      </div>
      {showSecondScreenPreview && (
        <SecondaryPreviewPortal>
          <div className="bg-background absolute inset-0 z-50 flex flex-col">
            <div className="flex h-12 shrink-0 items-center gap-2 border-b px-4 text-lg font-semibold">
              <Eye className="size-5" />
              {t('Preview')}
            </div>
            <div ref={previewScrollRef} className="min-h-0 flex-1 overflow-y-auto px-6 pt-7 pb-8">
              {preview}
            </div>
          </div>
        </SecondaryPreviewPortal>
      )}
      <LongFormDraftPicker
        open={draftPickerOpen}
        drafts={drafts}
        currentIdentifier={draft.identifier}
        isSmallScreen={isSmallScreen}
        onOpenChange={setDraftPickerOpen}
        onNew={startNewDraft}
        onSelect={selectDraft}
        onDelete={deleteDraft}
      />
    </EditorLayout>
  )

  return isSecondaryEditor && showSecondScreenPreview ? (
    <EditorPanelPortal panelId="primary-page-panel" active={active}>
      <div className="bg-background absolute inset-0 z-40">{editor}</div>
    </EditorPanelPortal>
  ) : (
    editor
  )
})

LongFormEditorPage.displayName = 'LongFormEditorPage'
export default LongFormEditorPage

function LongFormDraftPicker({
  open,
  drafts,
  currentIdentifier,
  isSmallScreen,
  onOpenChange,
  onNew,
  onSelect,
  onDelete
}: {
  open: boolean
  drafts: TLongFormDraft[]
  currentIdentifier: string
  isSmallScreen: boolean
  onOpenChange: (open: boolean) => void
  onNew: () => void
  onSelect: (draft: TLongFormDraft) => void
  onDelete: (identifier: string) => void
}) {
  const { t } = useTranslation()

  const body = (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between gap-3 px-4 pb-6 sm:px-6">
        <div className="flex items-baseline gap-2 text-lg font-semibold">
          {t('Drafts')}
          <span className="text-muted-foreground text-sm font-normal">({drafts.length})</span>
        </div>
        <Button type="button" size="sm" className="gap-1.5 rounded-full" onClick={onNew}>
          <Plus className="size-4" />
          {t('New article')}
        </Button>
      </div>
      <div className="bg-border h-px" />
      <ScrollArea
        className={cn(
          'min-h-0 flex-1',
          !isSmallScreen && drafts.length > 0 && 'h-[min(60vh,30rem)]'
        )}
      >
        {drafts.length === 0 ? (
          <div className="text-muted-foreground px-6 py-12 text-center text-sm">
            {t('No drafts yet')}
          </div>
        ) : (
          <div className="divide-y">
            {drafts.map((item) => {
              const preview = item.summary.trim() || item.content.trim()
              return (
                <ClickableCard
                  key={item.identifier}
                  aria-current={item.identifier === currentIdentifier ? 'true' : undefined}
                  className={cn(
                    'hover:bg-muted/40 flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors sm:px-6',
                    item.identifier === currentIdentifier && 'bg-muted/50'
                  )}
                  onClick={() => onSelect(item)}
                >
                  <div className="min-w-0 flex-1">
                    <div dir="auto" className="truncate font-medium">
                      {item.title.trim() || t('Untitled article')}
                    </div>
                    {preview && (
                      <div
                        dir="auto"
                        className="text-muted-foreground mt-0.5 line-clamp-2 text-sm break-words"
                      >
                        {preview}
                      </div>
                    )}
                    <div className="text-muted-foreground mt-1 text-xs">
                      {t('Last edited')} {dayjs(item.updatedAt).format('YYYY-MM-DD HH:mm')}
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost-destructive"
                    size="icon"
                    className="shrink-0"
                    title={t('Delete')}
                    onClick={() => onDelete(item.identifier)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </ClickableCard>
              )
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  )

  if (isSmallScreen) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent
          title={t('Drafts')}
          className="flex h-[75dvh] max-h-[75dvh] flex-col overflow-hidden"
        >
          {body}
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        withoutClose
        className="flex max-h-[80vh] max-w-xl flex-col gap-0 overflow-hidden p-0"
      >
        <DialogHeader className="sr-only">
          <DialogTitle>{t('Drafts')}</DialogTitle>
          <DialogDescription>{t('Drafts')}</DialogDescription>
        </DialogHeader>
        <div className="flex min-h-0 flex-1 flex-col pt-6">{body}</div>
      </DialogContent>
    </Dialog>
  )
}

function SecondaryPreviewPortal({ children }: { children: React.ReactNode }) {
  const active = usePageActive()
  return (
    <EditorPanelPortal panelId="secondary-page-panel" active={active}>
      {children}
    </EditorPanelPortal>
  )
}

function EditorPanelPortal({
  panelId,
  active,
  children
}: {
  panelId: string
  active: boolean
  children: React.ReactNode
}) {
  const [target, setTarget] = useState<HTMLElement | null>(null)

  useEffect(() => {
    setTarget(active ? document.getElementById(panelId) : null)
  }, [active, panelId])

  if (!active || !target) return null
  return createPortal(children, target)
}

function MarkdownToolbar({
  showEditorTabs,
  onWrap,
  onPrefix,
  onImageUpload,
  uploadProgress,
  setUploadProgress
}: {
  showEditorTabs: boolean
  onWrap: (before: string, after?: string) => void
  onPrefix: (prefix: string) => void
  onImageUpload: (url: string, name: string) => void
  uploadProgress?: number
  setUploadProgress: (progress?: number) => void
}) {
  const { t } = useTranslation()
  const tools = [
    { title: t('Heading'), icon: Heading2, action: () => onPrefix('## ') },
    { title: t('Heading 3'), icon: Heading3, action: () => onPrefix('### ') },
    { title: t('Heading 4'), icon: Heading4, action: () => onPrefix('#### ') },
    { title: t('Bold'), icon: Bold, action: () => onWrap('**', '**') },
    { title: t('Italic'), icon: Italic, action: () => onWrap('*', '*') },
    { title: t('Quote'), icon: Quote, action: () => onPrefix('> ') },
    { title: t('Bulleted list'), icon: List, action: () => onPrefix('- ') },
    { title: t('Numbered list'), icon: ListOrdered, action: () => onPrefix('1. ') },
    { title: t('To-do list'), icon: ListTodo, action: () => onPrefix('- [ ] ') },
    { title: t('Link'), icon: Link, action: () => onWrap('[', '](https://)') },
    { title: t('Code'), icon: Code2, action: () => onWrap('`', '`') }
  ]

  return (
    <div
      className={cn(
        'bg-muted/40 scrollbar-hide sticky z-10 flex items-center gap-0.5 overflow-x-auto rounded-lg p-1.5 backdrop-blur-md',
        showEditorTabs ? 'top-[113px]' : 'top-14'
      )}
    >
      {tools.map(({ title, icon: Icon, action }) => (
        <Button
          key={title}
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 shrink-0"
          title={title}
          onMouseDown={(event) => event.preventDefault()}
          onClick={action}
        >
          <Icon className="size-4" />
        </Button>
      ))}
      <div className="bg-border mx-1 h-5 w-px shrink-0" />
      <Uploader
        accept="image/*"
        onUploadSuccess={({ url }, file) => onImageUpload(url, file.name)}
        onUploadStart={() => setUploadProgress(0)}
        onProgress={(_, progress) => setUploadProgress(progress)}
        onUploadEnd={() => setUploadProgress(undefined)}
      >
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 shrink-0"
          title={t('Insert image')}
        >
          {uploadProgress === undefined ? (
            <ImagePlus className="size-4" />
          ) : (
            <Loader className="size-4 animate-spin" />
          )}
        </Button>
      </Uploader>
      {uploadProgress !== undefined && (
        <span className="text-muted-foreground px-1 text-xs">{Math.round(uploadProgress)}%</span>
      )}
    </div>
  )
}
