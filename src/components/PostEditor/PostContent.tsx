import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  createCommentDraftEvent,
  createHighlightDraftEvent,
  createPollDraftEvent,
  createShortTextNoteDraftEvent,
  deleteDraftEventCache
} from '@/lib/draft-event'
import { getDefaultRelayUrls } from '@/lib/relay'
import { useNostr } from '@/providers/NostrProvider'
import mediaUpload from '@/services/media-upload.service'
import postEditorCache from '@/services/post-editor-cache.service'
import threadService from '@/services/thread.service'
import { TPollCreateData } from '@/types'
import {
  CircleHelp,
  ImageUp,
  ListTodo,
  LoaderCircle,
  Lock,
  Settings,
  Smile,
  X
} from 'lucide-react'
import { Event, kinds } from 'nostr-tools'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import ExpressionPickerDialog from '../ExpressionPickerDialog'
import Mentions from './Mentions'
import ParentEventPreview from './ParentEventPreview'
import PollEditor from './PollEditor'
import PostOptions from './PostOptions'
import PostRelaySelector from './PostRelaySelector'
import PostTextarea, { TPostTextareaHandle } from './PostTextarea'
import Uploader from './Uploader'
import { formatError } from '@/lib/error'

export default function PostContent({
  defaultContent = '',
  parentStuff,
  close,
  openFrom,
  highlightedText
}: {
  defaultContent?: string
  parentStuff?: Event | string
  close: () => void
  openFrom?: string[]
  highlightedText?: string
}) {
  const { t } = useTranslation()
  const { pubkey, publish, checkLogin } = useNostr()
  const [text, setText] = useState('')
  const textareaRef = useRef<TPostTextareaHandle>(null)
  const [posting, setPosting] = useState(false)
  const [uploadProgresses, setUploadProgresses] = useState<
    { file: File; progress: number; cancel: () => void }[]
  >([])
  const parentEvent = useMemo(
    () => (parentStuff && typeof parentStuff !== 'string' ? parentStuff : undefined),
    [parentStuff]
  )
  const [showMoreOptions, setShowMoreOptions] = useState(false)
  const [addClientTag, setAddClientTag] = useState(false)
  const [mentions, setMentions] = useState<string[]>([])
  const [isNsfw, setIsNsfw] = useState(false)
  const [isPoll, setIsPoll] = useState(false)
  const [isProtectedEvent, setIsProtectedEvent] = useState(false)
  const [additionalRelayUrls, setAdditionalRelayUrls] = useState<string[]>([])
  const [pollCreateData, setPollCreateData] = useState<TPollCreateData>({
    isMultipleChoice: false,
    options: ['', ''],
    endsAt: undefined,
    relays: []
  })
  const [minPow, setMinPow] = useState(0)
  const userDismissedProtected = useRef(false)
  const handleProtectedSuggestionChange = useCallback((suggested: boolean) => {
    if (suggested && !userDismissedProtected.current) {
      setIsProtectedEvent(true)
    }
  }, [])
  const handleProtectedToggle = useCallback((checked: boolean) => {
    if (!checked) {
      userDismissedProtected.current = true
    }
    setIsProtectedEvent(checked)
  }, [])
  const isFirstRender = useRef(true)
  const canPost = useMemo(() => {
    return (
      !!pubkey &&
      (!!text || !!highlightedText) &&
      !posting &&
      !uploadProgresses.length &&
      (!isPoll || pollCreateData.options.filter((option) => !!option.trim()).length >= 2) &&
      (!isProtectedEvent || additionalRelayUrls.length > 0)
    )
  }, [
    pubkey,
    text,
    highlightedText,
    posting,
    uploadProgresses,
    isPoll,
    pollCreateData,
    isProtectedEvent,
    additionalRelayUrls
  ])

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      const cachedSettings = postEditorCache.getPostSettingsCache({
        defaultContent,
        parentStuff
      })
      if (cachedSettings) {
        setIsNsfw(cachedSettings.isNsfw ?? false)
        setIsPoll(cachedSettings.isPoll ?? false)
        setPollCreateData(
          cachedSettings.pollCreateData ?? {
            isMultipleChoice: false,
            options: ['', ''],
            endsAt: undefined,
            relays: []
          }
        )
        setAddClientTag(cachedSettings.addClientTag ?? false)
      }
      return
    }
    postEditorCache.setPostSettingsCache(
      { defaultContent, parentStuff },
      {
        isNsfw,
        isPoll,
        pollCreateData,
        addClientTag
      }
    )
  }, [defaultContent, parentStuff, isNsfw, isPoll, pollCreateData, addClientTag])

  const postingRef = useRef(false)

  const post = async (e?: React.MouseEvent) => {
    e?.stopPropagation()
    checkLogin(async () => {
      if (!canPost || !pubkey || postingRef.current) return

      postingRef.current = true
      setPosting(true)
      try {
        const draftEvent = await createDraftEvent({
          parentStuff,
          highlightedText,
          text,
          mentions,
          isPoll,
          pollCreateData,
          pubkey,
          addClientTag,
          isProtectedEvent,
          isNsfw
        })

        const _additionalRelayUrls = [...additionalRelayUrls]
        if (parentStuff && typeof parentStuff === 'string') {
          _additionalRelayUrls.push(...getDefaultRelayUrls())
        }

        const newEvent = await publish(draftEvent, {
          specifiedRelayUrls: isProtectedEvent ? additionalRelayUrls : undefined,
          additionalRelayUrls: isPoll ? pollCreateData.relays : _additionalRelayUrls,
          minPow
        })
        postEditorCache.clearPostCache({ defaultContent, parentStuff })
        deleteDraftEventCache(draftEvent)
        threadService.addRepliesToThread([newEvent])
        toast.success(t('Post successful'), { duration: 2000 })
        close()
      } catch (error) {
        const errors = formatError(error)
        errors.forEach((err) => {
          toast.error(`${t('Failed to post')}: ${err}`, { duration: 10_000 })
        })
        return
      } finally {
        setPosting(false)
        postingRef.current = false
      }
    })
  }

  const handlePollToggle = () => {
    if (parentStuff) return

    setIsPoll((prev) => !prev)
  }

  const handleUploadStart = (file: File, cancel: () => void) => {
    setUploadProgresses((prev) => [...prev, { file, progress: 0, cancel }])
  }

  const handleUploadProgress = (file: File, progress: number) => {
    setUploadProgresses((prev) =>
      prev.map((item) => (item.file === file ? { ...item, progress } : item))
    )
  }

  const handleUploadEnd = (file: File) => {
    setUploadProgresses((prev) => prev.filter((item) => item.file !== file))
  }

  return (
    <div className="pb-2">

      {uploadProgresses.length > 0 && (
        <div className="space-y-2 px-5 pb-3 sm:px-6">
          {uploadProgresses.map(({ file, progress, cancel }, index) => (
            <div key={`${file.name}-${index}`} className="flex items-end gap-2">
              <div className="min-w-0 flex-1">
                <div className="mb-1 truncate text-xs text-muted-foreground">
                  {file.name ?? t('Uploading...')}
                </div>
                <div className="h-0.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-primary transition-[width] duration-200 ease-out"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  cancel?.()
                  handleUploadEnd(file)
                }}
                className="text-muted-foreground hover:text-foreground"
                title={t('Cancel')}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {parentEvent && (
        <>
          <ParentEventPreview parentEvent={parentEvent} highlightedText={highlightedText} />
          <div className="h-px bg-border" />
        </>
      )}

      <PostTextarea
        ref={textareaRef}
        text={text}
        setText={setText}
        defaultContent={defaultContent}
        parentStuff={parentStuff}
        onSubmit={() => post()}
        className={isPoll ? 'min-h-20' : 'min-h-52'}
        onUploadStart={handleUploadStart}
        onUploadProgress={handleUploadProgress}
        onUploadEnd={handleUploadEnd}
        placeholder={
          highlightedText ? t('Write your thoughts about this highlight...') : undefined
        }
        topRightActions={
          <Button
            type="submit"
            size="sm"
            disabled={!canPost}
            onClick={post}
            className="px-4 text-sm font-semibold shadow-sm"
          >
            {posting && <LoaderCircle className="animate-spin" />}
            {parentStuff ? (highlightedText ? t('Publish Highlight') : t('Reply')) : t('Post')}
          </Button>
        }
      />

      {isPoll && (
        <div className="px-5 pb-3 sm:px-6">
          <PollEditor
            pollCreateData={pollCreateData}
            setPollCreateData={setPollCreateData}
            setIsPoll={setIsPoll}
          />
        </div>
      )}

      {!isPoll && (
        <div className="flex items-center gap-2 px-3 py-2 sm:px-4">
          <div className="flex shrink-0 items-center gap-0.5">
            <Button
              variant="ghost"
              size="sm"
              className={
                isProtectedEvent
                  ? 'h-9 gap-1.5 bg-emerald-500/15 px-2.5 text-sm font-normal text-emerald-600 hover:bg-emerald-500/20 hover:text-emerald-600 dark:text-emerald-400 dark:hover:text-emerald-400'
                  : 'h-9 gap-1.5 px-2.5 text-sm font-normal text-muted-foreground hover:text-foreground'
              }
              onClick={() => handleProtectedToggle(!isProtectedEvent)}
            >
              <Lock className="size-4 shrink-0" />
              <span>{t('Protected')}</span>
            </Button>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 text-muted-foreground hover:text-foreground"
                  title={t('Protected event hint')}
                >
                  <CircleHelp className="size-4!" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="text-sm">{t('Protected event hint')}</PopoverContent>
            </Popover>
          </div>
          <div className="flex min-w-0 flex-1 justify-end">
            <PostRelaySelector
              onProtectedSuggestionChange={handleProtectedSuggestionChange}
              setAdditionalRelayUrls={setAdditionalRelayUrls}
              parentEvent={parentEvent}
              openFrom={openFrom}
            />
          </div>
        </div>
      )}

      <div className="h-px bg-border" />
      <div className="flex items-center justify-between gap-2 px-3 py-2 sm:px-4">
        <div className="flex items-center gap-0.5">
          <Uploader
            onUploadSuccess={({ url }) => {
              textareaRef.current?.appendText(url, true)
            }}
            onUploadStart={handleUploadStart}
            onUploadEnd={handleUploadEnd}
            onProgress={handleUploadProgress}
            accept="image/*,video/*,audio/*"
          >
            <Button variant="ghost" size="icon" title={t('Upload')}>
              <ImageUp />
            </Button>
          </Uploader>
          <ExpressionPickerDialog
            enableGif
            onEmojiClick={(emoji) => {
              if (!emoji) return
              textareaRef.current?.insertEmoji(emoji)
            }}
            onGifClick={(gif) => {
              if (!gif) return
              if (gif.width > 0 && gif.height > 0) {
                mediaUpload.registerImetaTag(gif.url, [
                  'imeta',
                  `url ${gif.url}`,
                  `dim ${gif.width}x${gif.height}`
                ])
              }
              textareaRef.current?.appendText(gif.url, true)
            }}
          >
            <Button variant="ghost" size="icon" title={t('Emoji')}>
              <Smile />
            </Button>
          </ExpressionPickerDialog>
          {!parentStuff && (
            <Button
              variant="ghost"
              size="icon"
              title={t('Create Poll')}
              className={isPoll ? 'bg-muted text-foreground' : ''}
              onClick={handlePollToggle}
            >
              <ListTodo />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            title={t('Post settings')}
            className={showMoreOptions ? 'bg-muted text-foreground' : ''}
            onClick={() => setShowMoreOptions((pre) => !pre)}
          >
            <Settings />
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Mentions
            content={text}
            parentEvent={parentEvent}
            mentions={mentions}
            setMentions={setMentions}
          />
          <div className="hidden items-center gap-2 sm:flex">
            <Button
              variant="ghost"
              className="text-muted-foreground hover:text-foreground"
              onClick={(e) => {
                e.stopPropagation()
                close()
              }}
            >
              {t('Cancel')}
            </Button>
            <Button
              type="submit"
              disabled={!canPost}
              onClick={post}
              className="px-5 font-semibold shadow-sm"
            >
              {posting && <LoaderCircle className="animate-spin" />}
              {parentStuff ? (highlightedText ? t('Publish Highlight') : t('Reply')) : t('Post')}
            </Button>
          </div>
        </div>
      </div>

      {showMoreOptions && (
        <>
          <div className="h-px bg-border" />
          <div className="px-5 py-3 sm:px-6">
            <PostOptions
              posting={posting}
              show={showMoreOptions}
              addClientTag={addClientTag}
              setAddClientTag={setAddClientTag}
              isNsfw={isNsfw}
              setIsNsfw={setIsNsfw}
              minPow={minPow}
              setMinPow={setMinPow}
            />
          </div>
        </>
      )}
    </div>
  )
}

async function createDraftEvent({
  parentStuff,
  text,
  mentions,
  isPoll,
  pollCreateData,
  pubkey,
  addClientTag,
  isProtectedEvent,
  isNsfw,
  highlightedText
}: {
  parentStuff: Event | string | undefined
  text: string
  mentions: string[]
  isPoll: boolean
  pollCreateData: TPollCreateData
  pubkey: string
  addClientTag: boolean
  isProtectedEvent: boolean
  isNsfw: boolean
  highlightedText?: string
}) {
  const { parentEvent, externalContent } =
    typeof parentStuff === 'string'
      ? { parentEvent: undefined, externalContent: parentStuff }
      : { parentEvent: parentStuff, externalContent: undefined }

  if (highlightedText && parentEvent) {
    return createHighlightDraftEvent(highlightedText, text, parentEvent, mentions, {
      addClientTag,
      protectedEvent: isProtectedEvent,
      isNsfw
    })
  }

  if (parentStuff && (externalContent || parentEvent?.kind !== kinds.ShortTextNote)) {
    return await createCommentDraftEvent(text, parentStuff, mentions, {
      addClientTag,
      protectedEvent: isProtectedEvent,
      isNsfw
    })
  }

  if (isPoll) {
    return await createPollDraftEvent(pubkey, text, mentions, pollCreateData, {
      addClientTag,
      isNsfw
    })
  }

  return await createShortTextNoteDraftEvent(text, mentions, {
    parentEvent,
    addClientTag,
    protectedEvent: isProtectedEvent,
    isNsfw
  })
}
