import Note from '@/components/Note'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { BIG_RELAY_URLS } from '@/constants'
import {
  createCommentDraftEvent,
  createHighlightDraftEvent,
  createPollDraftEvent,
  createShortTextNoteDraftEvent,
  deleteDraftEventCache
} from '@/lib/draft-event'
import { isTouchDevice } from '@/lib/utils'
import { useNostr } from '@/providers/NostrProvider'
import postEditorCache from '@/services/post-editor-cache.service'
import threadService from '@/services/thread.service'
import { TPollCreateData } from '@/types'
import { ImageUp, ListTodo, LoaderCircle, Settings, Smile, X } from 'lucide-react'
import { Event, kinds } from 'nostr-tools'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import EmojiPickerDialog from '../EmojiPickerDialog'
import Mentions from './Mentions'
import PollEditor from './PollEditor'
import PostOptions from './PostOptions'
import PostRelaySelector from './PostRelaySelector'
import PostTextarea, { TPostTextareaHandle } from './PostTextarea'
import Uploader from './Uploader'

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
          _additionalRelayUrls.push(...BIG_RELAY_URLS)
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
        const errors = error instanceof AggregateError ? error.errors : [error]
        errors.forEach((err) => {
          toast.error(
            `${t('Failed to post')}: ${err instanceof Error ? err.message : String(err)}`,
            { duration: 10_000 }
          )
          console.error(err)
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
    <div className="space-y-2">
      {parentEvent && (
        <ScrollArea className="flex max-h-48 flex-col overflow-y-auto rounded-lg border bg-muted/40">
          <div className="p-2 sm:p-3 pointer-events-none">
            {highlightedText ? (
              <div className="flex gap-4">
                <div className="w-1 flex-shrink-0 my-1 bg-primary/60 rounded-md" />
                <div className="italic whitespace-pre-line">{highlightedText}</div>
              </div>
            ) : (
              <Note size="small" event={parentEvent} hideParentNotePreview />
            )}
          </div>
        </ScrollArea>
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
        placeholder={highlightedText ? t('Write your thoughts about this highlight...') : undefined}
      />
      {isPoll && (
        <PollEditor
          pollCreateData={pollCreateData}
          setPollCreateData={setPollCreateData}
          setIsPoll={setIsPoll}
        />
      )}
      {uploadProgresses.length > 0 &&
        uploadProgresses.map(({ file, progress, cancel }, index) => (
          <div key={`${file.name}-${index}`} className="mt-2 flex items-end gap-2">
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs text-muted-foreground mb-1">
                {file.name ?? t('Uploading...')}
              </div>
              <div className="h-0.5 w-full rounded-full bg-muted overflow-hidden">
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
      {!isPoll && (
        <PostRelaySelector
          setIsProtectedEvent={setIsProtectedEvent}
          setAdditionalRelayUrls={setAdditionalRelayUrls}
          parentEvent={parentEvent}
          openFrom={openFrom}
        />
      )}
      <div className="flex items-center justify-between">
        <div className="flex gap-2 items-center">
          <Uploader
            onUploadSuccess={({ url }) => {
              textareaRef.current?.appendText(url, true)
            }}
            onUploadStart={handleUploadStart}
            onUploadEnd={handleUploadEnd}
            onProgress={handleUploadProgress}
            accept="image/*,video/*,audio/*"
          >
            <Button variant="ghost" size="icon">
              <ImageUp />
            </Button>
          </Uploader>
          {/* I'm not sure why, but after triggering the virtual keyboard,
              opening the emoji picker drawer causes an issue,
              the emoji I tap isn't the one that gets inserted. */}
          {!isTouchDevice() && (
            <EmojiPickerDialog
              onEmojiClick={(emoji) => {
                if (!emoji) return
                textareaRef.current?.insertEmoji(emoji)
              }}
            >
              <Button variant="ghost" size="icon">
                <Smile />
              </Button>
            </EmojiPickerDialog>
          )}
          {!parentStuff && (
            <Button
              variant="ghost"
              size="icon"
              title={t('Create Poll')}
              className={isPoll ? 'bg-accent' : ''}
              onClick={handlePollToggle}
            >
              <ListTodo />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className={showMoreOptions ? 'bg-accent' : ''}
            onClick={() => setShowMoreOptions((pre) => !pre)}
          >
            <Settings />
          </Button>
        </div>
        <div className="flex gap-2 items-center">
          <Mentions
            content={text}
            parentEvent={parentEvent}
            mentions={mentions}
            setMentions={setMentions}
          />
          <div className="flex gap-2 items-center max-sm:hidden">
            <Button
              variant="secondary"
              onClick={(e) => {
                e.stopPropagation()
                close()
              }}
            >
              {t('Cancel')}
            </Button>
            <Button type="submit" disabled={!canPost} onClick={post}>
              {posting && <LoaderCircle className="animate-spin" />}
              {parentStuff ? (highlightedText ? t('Publish Highlight') : t('Reply')) : t('Post')}
            </Button>
          </div>
        </div>
      </div>
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
      <div className="flex gap-2 items-center justify-around sm:hidden">
        <Button
          className="w-full"
          variant="secondary"
          onClick={(e) => {
            e.stopPropagation()
            close()
          }}
        >
          {t('Cancel')}
        </Button>
        <Button className="w-full" type="submit" disabled={!canPost} onClick={post}>
          {posting && <LoaderCircle className="animate-spin" />}
          {parentStuff ? t('Reply') : t('Post')}
        </Button>
      </div>
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
