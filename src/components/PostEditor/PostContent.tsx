import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { createAnonymousSigner, TAnonymousSigner } from '@/lib/anonymous-signer'
import { formatError } from '@/lib/error'
import DraftsButton from './DraftsButton'
import {
  collectCustomEmojisInText,
  collectImetaTagsForUrls,
  rehydrateDraftRuntime
} from '@/lib/post-draft'
import {
  createCommentDraftEvent,
  createHighlightDraftEvent,
  createPollDraftEvent,
  createShortTextNoteDraftEvent,
  deleteDraftEventCache
} from '@/lib/draft-event'
import { minePow } from '@/lib/event'
import { randomId } from '@/lib/utils'
import { getDefaultRelayUrls } from '@/lib/relay'
import { useNostr } from '@/providers/NostrProvider'
import mediaUpload from '@/services/media-upload.service'
import client from '@/services/client.service'
import postDraftService from '@/services/post-draft.service'
import { ISigner, TPollCreateData, TPostTargetItem } from '@/types'
import { TPostDraftUnsigned } from '@/types/post-draft'
import AuthorPicker, { TAuthorChoice } from './AuthorPicker'
import { Content } from '@tiptap/react'
import { CircleHelp, ImageUp, ListTodo, Lock, Settings, Smile, X } from 'lucide-react'
import { Event, kinds } from 'nostr-tools'
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState
} from 'react'
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

export type TPostContentHandle = {
  isDirty: () => boolean
  saveDraft: () => Promise<TPostDraftUnsigned | undefined>
  hasPersistedDraft: () => boolean
}

type Props = {
  defaultContent?: string
  parentStuff?: Event | string
  close: () => void
  requestClose?: () => void
  onOpenDrafts?: () => void
  onParentClick?: (parentEvent: Event) => void
  openFrom?: string[]
  highlightedText?: string
  initialDraft?: TPostDraftUnsigned
}

const PostContent = forwardRef<TPostContentHandle, Props>(function PostContent(
  {
    defaultContent = '',
    parentStuff: parentStuffProp,
    close,
    requestClose,
    onOpenDrafts,
    onParentClick,
    openFrom,
    highlightedText,
    initialDraft
  },
  ref
) {
  const { t } = useTranslation()
  const { pubkey, checkLogin, account, buildSignerForAccount } = useNostr()

  const [authorChoice, setAuthorChoice] = useState<TAuthorChoice>(() =>
    account ? { kind: 'account', account } : { kind: 'anonymous' }
  )
  const authorChoiceTouchedRef = useRef(false)
  const handleAuthorChoiceChange = useCallback((choice: TAuthorChoice) => {
    authorChoiceTouchedRef.current = true
    setAuthorChoice(choice)
  }, [])
  // If the editor mounted before login (so we defaulted to anonymous), latch
  // on to the account once it appears — but only if the user hasn't already
  // picked something explicitly. Picking another account or Anonymous is a
  // per-post override and must never be reverted automatically.
  useEffect(() => {
    if (authorChoiceTouchedRef.current) return
    if (account) setAuthorChoice({ kind: 'account', account })
  }, [account])
  // Ephemeral signer, lazily built on first use and reused across re-renders so
  // typing doesn't churn a new identity each keystroke. Never persisted.
  const anonymousSignerRef = useRef<TAnonymousSigner | null>(null)
  const getAnonymousSigner = () => {
    if (!anonymousSignerRef.current) {
      anonymousSignerRef.current = createAnonymousSigner()
    }
    return anonymousSignerRef.current
  }

  const initialParentStuff = useMemo<Event | string | undefined>(() => {
    if (initialDraft?.parentEvent) return initialDraft.parentEvent
    if (initialDraft?.parentEventCoordinate) return initialDraft.parentEventCoordinate
    return parentStuffProp
  }, [initialDraft, parentStuffProp])

  const initialContent = useMemo<Content | undefined>(() => {
    if (initialDraft) return initialDraft.tiptapJson as Content
    return defaultContent
  }, [initialDraft, defaultContent])

  const draftIdRef = useRef<string>(initialDraft?.id ?? randomId())
  const draftCreatedAtRef = useRef<number>(initialDraft?.createdAt ?? Date.now())
  const hasPersistedRef = useRef<boolean>(!!initialDraft)

  // Rehydrate runtime (imeta tags, custom emojis) before editor mounts content
  const rehydrated = useRef(false)
  if (initialDraft && !rehydrated.current) {
    rehydrateDraftRuntime(initialDraft)
    rehydrated.current = true
  }

  const [text, setText] = useState('')
  const textareaRef = useRef<TPostTextareaHandle>(null)
  const [uploadProgresses, setUploadProgresses] = useState<
    { file: File; progress: number; cancel: () => void }[]
  >([])
  const parentEvent = useMemo(
    () =>
      initialParentStuff && typeof initialParentStuff !== 'string' ? initialParentStuff : undefined,
    [initialParentStuff]
  )
  const [showMoreOptions, setShowMoreOptions] = useState(false)
  const [addClientTag, setAddClientTag] = useState(initialDraft?.addClientTag ?? false)
  const [mentions, setMentions] = useState<string[]>(initialDraft?.mentions ?? [])
  const [isNsfw, setIsNsfw] = useState(initialDraft?.isNsfw ?? false)
  const [isPoll, setIsPoll] = useState(initialDraft?.isPoll ?? false)
  const [isProtectedEvent, setIsProtectedEvent] = useState(initialDraft?.isProtectedEvent ?? false)
  const [additionalRelayUrls, setAdditionalRelayUrls] = useState<string[]>(
    initialDraft?.additionalRelayUrls ?? []
  )
  const [relayTargetItems, setRelayTargetItems] = useState<TPostTargetItem[]>(
    initialDraft?.postTargetItems ?? []
  )
  const [pollCreateData, setPollCreateData] = useState<TPollCreateData>(
    initialDraft?.pollCreateData ?? {
      isMultipleChoice: false,
      options: ['', ''],
      endsAt: undefined,
      relays: []
    }
  )
  const [minPow, setMinPow] = useState(initialDraft?.minPow ?? 0)
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

  const hasContent = !!text.trim() || (isPoll && pollCreateData.options.some((o) => o.trim()))

  const isAnonymous = authorChoice.kind === 'anonymous'
  // The picked author must be capable of signing. Anonymous always can (we
  // generate the key on the spot); a stored account can iff its signerType
  // isn't 'npub' (read-only). Independent of session state — a logged-out
  // user can still ship an anonymous post.
  const authorCanSign = isAnonymous || authorChoice.account.signerType !== 'npub'
  const canPost = useMemo(() => {
    return (
      authorCanSign &&
      (!!text || !!highlightedText) &&
      !uploadProgresses.length &&
      (!isPoll || pollCreateData.options.filter((option) => !!option.trim()).length >= 2) &&
      (!isProtectedEvent || additionalRelayUrls.length > 0)
    )
  }, [
    authorCanSign,
    text,
    highlightedText,
    uploadProgresses,
    isPoll,
    pollCreateData,
    isProtectedEvent,
    additionalRelayUrls
  ])

  const buildUnsignedDraft = useCallback((): TPostDraftUnsigned | undefined => {
    if (!pubkey) return undefined
    const tiptapJson = (textareaRef.current?.getJSON() as unknown) ?? null
    const parentEventObj = parentEvent
    const parentCoord = typeof initialParentStuff === 'string' ? initialParentStuff : undefined
    return {
      id: draftIdRef.current,
      pubkey,
      status: 'draft',
      createdAt: draftCreatedAtRef.current,
      updatedAt: Date.now(),
      tiptapJson,
      text,
      mentions,
      isNsfw,
      isPoll,
      pollCreateData,
      addClientTag,
      isProtectedEvent,
      additionalRelayUrls,
      postTargetItems: relayTargetItems,
      minPow,
      parentEvent: parentEventObj,
      parentEventCoordinate: parentCoord,
      defaultContent: defaultContent || undefined,
      highlightedText,
      openFrom,
      imetaTags: collectImetaTagsForUrls(text),
      customEmojis: collectCustomEmojisInText(text)
    }
  }, [
    pubkey,
    text,
    mentions,
    isNsfw,
    isPoll,
    pollCreateData,
    addClientTag,
    isProtectedEvent,
    additionalRelayUrls,
    relayTargetItems,
    minPow,
    parentEvent,
    initialParentStuff,
    defaultContent,
    highlightedText,
    openFrom
  ])

  const saveDraft = useCallback(async (): Promise<TPostDraftUnsigned | undefined> => {
    if (!pubkey) return undefined
    if (!hasContent) {
      // Editing an existing draft and clearing all its content means discard it,
      // otherwise the now-emptied draft would keep its stale previous content.
      if (hasPersistedRef.current) {
        await postDraftService.delete(draftIdRef.current)
        hasPersistedRef.current = false
      }
      return undefined
    }
    const record = buildUnsignedDraft()
    if (!record) return undefined
    try {
      const draftEvent = await createDraftEvent({
        parentStuff: initialParentStuff,
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
      record.previewEvent = {
        ...draftEvent,
        id: record.id,
        pubkey,
        sig: ''
      } as Event
    } catch {
      // best-effort preview; fall back to plain text rendering in the list
    }
    const saved = await postDraftService.saveDraft(record)
    hasPersistedRef.current = true
    return saved
  }, [
    pubkey,
    hasContent,
    buildUnsignedDraft,
    initialParentStuff,
    highlightedText,
    text,
    mentions,
    isPoll,
    pollCreateData,
    addClientTag,
    isProtectedEvent,
    isNsfw
  ])

  const isDirty = useCallback(() => {
    if (!hasContent) return false
    if (!initialDraft) return true
    // Compare against initial — cheap heuristic on text + settings
    return (
      text !== initialDraft.text ||
      isNsfw !== initialDraft.isNsfw ||
      isPoll !== initialDraft.isPoll ||
      addClientTag !== initialDraft.addClientTag ||
      isProtectedEvent !== initialDraft.isProtectedEvent ||
      minPow !== initialDraft.minPow ||
      JSON.stringify(mentions) !== JSON.stringify(initialDraft.mentions) ||
      JSON.stringify(pollCreateData) !== JSON.stringify(initialDraft.pollCreateData) ||
      JSON.stringify(additionalRelayUrls) !== JSON.stringify(initialDraft.additionalRelayUrls) ||
      JSON.stringify(relayTargetItems) !== JSON.stringify(initialDraft.postTargetItems ?? [])
    )
  }, [
    hasContent,
    initialDraft,
    text,
    isNsfw,
    isPoll,
    addClientTag,
    isProtectedEvent,
    minPow,
    mentions,
    pollCreateData,
    additionalRelayUrls,
    relayTargetItems
  ])

  useImperativeHandle(
    ref,
    () => ({ isDirty, saveDraft, hasPersistedDraft: () => hasPersistedRef.current }),
    [isDirty, saveDraft]
  )

  const postingRef = useRef(false)

  // Single source of truth for the signer this draft is authored with. The
  // editor produces an author-free TDraftEvent (no pubkey/id/sig); the signer
  // fills those in. So per-post author overrides are just a matter of swapping
  // which ISigner runs at sign time — nothing else in the post flow changes.
  const resolveAuthorSigner = async (): Promise<{ signer: ISigner; pubkey: string }> => {
    if (authorChoice.kind === 'anonymous') {
      return getAnonymousSigner()
    }
    const oneOff = await buildSignerForAccount(authorChoice.account)
    return { signer: oneOff, pubkey: authorChoice.account.pubkey }
  }

  // The draft queue is per-account: enqueueing under a different pubkey would
  // surface a foreign signed event in the active user's drafts box and let
  // them "retry" something they didn't author. So only the active account's
  // posts go through it; anonymous and other-account posts publish directly.
  const isCurrentAccountAuthor =
    authorChoice.kind === 'account' &&
    !!account &&
    authorChoice.account.pubkey === account.pubkey

  const post = async (e?: React.MouseEvent) => {
    e?.stopPropagation()
    const runPost = async () => {
      if (!canPost || postingRef.current) return
      postingRef.current = true
      try {
        const { signer: authorSigner, pubkey: authorPubkey } = await resolveAuthorSigner()

        const draftEvent = await createDraftEvent({
          parentStuff: initialParentStuff,
          highlightedText,
          text,
          mentions,
          isPoll,
          pollCreateData,
          pubkey: authorPubkey,
          // Suppress the NIP-89 client tag on anonymous posts even if the
          // user has the global toggle on. The tag wouldn't out the signer
          // directly, but every metadata bit narrows the set of plausible
          // authors. Anonymous should ship with the minimal fingerprint.
          addClientTag: isAnonymous ? false : addClientTag,
          isProtectedEvent,
          isNsfw
        })

        const _additionalRelayUrls = [...additionalRelayUrls]
        if (initialParentStuff && typeof initialParentStuff === 'string' && !isAnonymous) {
          // For external-content comments we normally fan out to the user's
          // default relays. Skip for anonymous — those defaults can leak the
          // user's customized relay set (paid/account-bound).
          _additionalRelayUrls.push(...getDefaultRelayUrls())
        }
        if (isAnonymous && parentEvent) {
          // "Publish to relays the thread lives on": anonymous replies should
          // land where the parent event is already visible, not on the
          // logged-in user's write relays.
          _additionalRelayUrls.push(...client.getSeenEventRelayUrls(parentEvent.id))
        }

        const publishOptions = {
          specifiedRelayUrls: isProtectedEvent ? additionalRelayUrls : undefined,
          additionalRelayUrls: isPoll ? pollCreateData.relays : _additionalRelayUrls,
          minPow,
          isAnonymous
        }

        const toSign = minPow > 0
          ? await minePow({ ...draftEvent, pubkey: authorPubkey }, minPow)
          : draftEvent
        const signed = await authorSigner.signEvent(toSign)

        deleteDraftEventCache(draftEvent)
        const targetRelays = await client.determineTargetRelays(signed, publishOptions)

        if (isCurrentAccountAuthor) {
          await postDraftService.enqueue({
            id: draftIdRef.current,
            pubkey: authorPubkey,
            createdAt: draftCreatedAtRef.current,
            signedEvent: signed,
            targetRelays,
            parentEvent,
            parentEventCoordinate:
              typeof initialParentStuff === 'string' ? initialParentStuff : undefined,
            highlightedText
          })
        } else {
          await client.publishEvent(targetRelays, signed)
        }
        close()
      } catch (error) {
        const errors = formatError(error)
        errors.forEach((err) => {
          toast.error(`${t('Failed to post')}: ${err}`, { duration: 10_000 })
        })
      } finally {
        postingRef.current = false
      }
    }

    if (authorChoice.kind === 'anonymous') {
      // Anonymous doesn't need a logged-in user — skip the login gate.
      runPost()
    } else {
      checkLogin(runPost)
    }
  }

  const handlePollToggle = () => {
    if (initialParentStuff) return
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

  // Keep mentions in sync with initialDraft load
  useEffect(() => {
    if (initialDraft) {
      setMentions(initialDraft.mentions ?? [])
    }
  }, [initialDraft])

  return (
    <div className="pb-2">
      {parentEvent && (
        <>
          <ParentEventPreview
            parentEvent={parentEvent}
            highlightedText={highlightedText}
            onClick={onParentClick ? () => onParentClick(parentEvent) : undefined}
          />
          <div className="bg-border h-px" />
        </>
      )}

      <PostTextarea
        ref={textareaRef}
        text={text}
        setText={setText}
        initialContent={initialContent}
        onSubmit={() => post()}
        className={isPoll ? 'min-h-20' : 'min-h-52'}
        onUploadStart={handleUploadStart}
        onUploadProgress={handleUploadProgress}
        onUploadEnd={handleUploadEnd}
        placeholder={highlightedText ? t('Write your thoughts about this highlight...') : undefined}
        topLeftActions={<AuthorPicker value={authorChoice} onChange={handleAuthorChoiceChange} />}
        topRightActions={
          <div className="flex items-center gap-1">
            <DraftsButton onClick={() => onOpenDrafts?.()} />
            <Button
              type="submit"
              size="sm"
              disabled={!canPost}
              // Don't let the press blur the editor: on mobile that dismisses the
              // virtual keyboard and shifts the layout, so the first tap is eaten
              // and the user has to tap "send" twice. Keeping focus fires post() now.
              onMouseDown={(e) => e.preventDefault()}
              onClick={post}
              className="px-4 text-sm font-semibold shadow-sm"
            >
              {initialParentStuff
                ? highlightedText
                  ? t('Publish Highlight')
                  : t('Reply')
                : t('Post')}
            </Button>
          </div>
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
                  : 'text-muted-foreground hover:text-foreground h-9 gap-1.5 px-2.5 text-sm font-normal'
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
                  className="text-muted-foreground hover:text-foreground size-7"
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
              initialItems={initialDraft?.postTargetItems}
              onItemsChange={setRelayTargetItems}
            />
          </div>
        </div>
      )}

      <div className="bg-border h-px" />

      {uploadProgresses.length > 0 && (
        <div className="space-y-2 px-5.5 py-2 sm:px-7">
          {uploadProgresses.map(({ file, progress, cancel }, index) => (
            <div key={`${file.name}-${index}`} className="flex items-end gap-2">
              <div className="min-w-0 flex-1">
                <div className="text-muted-foreground mb-1 truncate text-xs">
                  {file.name ?? t('Uploading...')}
                </div>
                <div className="bg-muted h-0.5 w-full overflow-hidden rounded-full">
                  <div
                    className="bg-primary h-full transition-[width] duration-200 ease-out"
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
          {!initialParentStuff && (
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
            // Filter the *effective* author out of suggested mentions, not
            // the logged-in user. Anonymous → undefined so the logged-in user
            // (a legitimate mention target) is not stripped; posting as
            // another account → that account's pubkey so it doesn't suggest
            // self-mention.
            authorPubkey={
              authorChoice.kind === 'anonymous' ? undefined : authorChoice.account.pubkey
            }
          />
          <div className="hidden items-center gap-2 sm:flex">
            <Button
              variant="ghost"
              className="text-muted-foreground hover:text-foreground"
              onClick={(e) => {
                e.stopPropagation()
                ;(requestClose ?? close)()
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
              {initialParentStuff
                ? highlightedText
                  ? t('Publish Highlight')
                  : t('Reply')
                : t('Post')}
            </Button>
          </div>
        </div>
      </div>

      {showMoreOptions && (
        <>
          <div className="bg-border h-px" />
          <div className="px-5 py-3 sm:px-6">
            <PostOptions
              posting={false}
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
})

export default PostContent

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
