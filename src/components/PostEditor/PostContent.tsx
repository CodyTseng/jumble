import Note from '@/components/Note'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  createCommentDraftEvent,
  createPollDraftEvent,
  createShortTextNoteDraftEvent
} from '@/lib/draft-event'
import { isTouchDevice } from '@/lib/utils'
import { useNostr } from '@/providers/NostrProvider'
import postEditorCache from '@/services/post-editor-cache.service'
import { TPollCreateData } from '@/types'
import { ImageUp, ListTodo, LoaderCircle, Settings, Smile } from 'lucide-react'
import { Event, kinds } from 'nostr-tools'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import EmojiPickerDialog from '../EmojiPickerDialog'
import Mentions from './Mentions'
import PollEditor from './PollEditor'
import { usePostEditor } from './PostEditorProvider'
import PostOptions from './PostOptions'
import PostTextarea, { TPostTextareaHandle } from './PostTextarea'
import SendOnlyToSwitch from './SendOnlyToSwitch'
import Uploader from './Uploader'

export default function PostContent({
  defaultContent = '',
  parentEvent,
  close
}: {
  defaultContent?: string
  parentEvent?: Event
  close: () => void
}) {
  const { t } = useTranslation()
  const { pubkey, publish, checkLogin } = useNostr()
  const { uploadingFiles, setUploadingFiles } = usePostEditor()
  const [text, setText] = useState('')
  const textareaRef = useRef<TPostTextareaHandle>(null)
  const [posting, setPosting] = useState(false)
  const [showMoreOptions, setShowMoreOptions] = useState(false)
  const [addClientTag, setAddClientTag] = useState(false)
  const [specifiedRelayUrls, setSpecifiedRelayUrls] = useState<string[] | undefined>(undefined)
  const [mentions, setMentions] = useState<string[]>([])
  const [isNsfw, setIsNsfw] = useState(false)
  const [isPoll, setIsPoll] = useState(false)
  const [pollCreateData, setPollCreateData] = useState<TPollCreateData>({
    isMultipleChoice: false,
    options: ['', ''],
    endsAt: undefined,
    relays: []
  })
  const isFirstRender = useRef(true)
  const canPost =
    !!pubkey &&
    !!text &&
    !posting &&
    !uploadingFiles &&
    (!isPoll || pollCreateData.options.filter((option) => !!option.trim()).length >= 2)

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      const cachedSettings = postEditorCache.getPostSettingsCache({
        defaultContent,
        parentEvent
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
        setSpecifiedRelayUrls(cachedSettings.specifiedRelayUrls)
        setAddClientTag(cachedSettings.addClientTag ?? false)
      }
      return
    }
    postEditorCache.setPostSettingsCache(
      { defaultContent, parentEvent },
      {
        isNsfw,
        isPoll,
        pollCreateData,
        specifiedRelayUrls,
        addClientTag
      }
    )
  }, [
    defaultContent,
    parentEvent,
    isNsfw,
    isPoll,
    pollCreateData,
    specifiedRelayUrls,
    addClientTag
  ])

  const post = async (e?: React.MouseEvent) => {
    e?.stopPropagation()
    checkLogin(async () => {
      if (!canPost) return

      setPosting(true)
      try {
        const draftEvent =
          parentEvent && parentEvent.kind !== kinds.ShortTextNote
            ? await createCommentDraftEvent(text, parentEvent, mentions, {
                addClientTag,
                protectedEvent: !!specifiedRelayUrls,
                isNsfw
              })
            : isPoll
              ? await createPollDraftEvent(pubkey, text, mentions, pollCreateData, {
                  addClientTag,
                  isNsfw
                })
              : await createShortTextNoteDraftEvent(text, mentions, {
                  parentEvent,
                  addClientTag,
                  protectedEvent: !!specifiedRelayUrls,
                  isNsfw
                })

        await publish(draftEvent, {
          specifiedRelayUrls,
          additionalRelayUrls: isPoll ? pollCreateData.relays : []
        })
        postEditorCache.clearPostCache({ defaultContent, parentEvent })
        close()
      } catch (error) {
        if (error instanceof AggregateError) {
          error.errors.forEach((e) => toast.error(`${t('Failed to post')}: ${e.message}`))
        } else if (error instanceof Error) {
          toast.error(`${t('Failed to post')}: ${error.message}`)
        }
        console.error(error)
        return
      } finally {
        setPosting(false)
      }
      toast.success(t('Post successful'), { duration: 2000 })
    })
  }

  const handlePollToggle = () => {
    if (parentEvent) return

    setIsPoll((prev) => !prev)
  }

  return (
    <div className="space-y-2">
      {parentEvent && (
        <ScrollArea className="flex max-h-48 flex-col overflow-y-auto rounded-lg border bg-muted/40">
          <div className="p-2 sm:p-3 pointer-events-none">
            <Note size="small" event={parentEvent} hideParentNotePreview />
          </div>
        </ScrollArea>
      )}
      <PostTextarea
        ref={textareaRef}
        text={text}
        setText={setText}
        defaultContent={defaultContent}
        parentEvent={parentEvent}
        onSubmit={() => post()}
        className={isPoll ? 'h-20' : 'min-h-52'}
      />
      {isPoll && (
        <PollEditor
          pollCreateData={pollCreateData}
          setPollCreateData={setPollCreateData}
          setIsPoll={setIsPoll}
        />
      )}
      {!isPoll && (
        <SendOnlyToSwitch
          parentEvent={parentEvent}
          specifiedRelayUrls={specifiedRelayUrls}
          setSpecifiedRelayUrls={setSpecifiedRelayUrls}
        />
      )}
      <div className="flex items-center justify-between">
        <div className="flex gap-2 items-center">
          <Uploader
            onUploadSuccess={({ url }) => {
              textareaRef.current?.appendText(url, true)
            }}
            onUploadingChange={(uploading) =>
              setUploadingFiles((prev) => (uploading ? prev + 1 : prev - 1))
            }
            accept="image/*,video/*,audio/*"
          >
            <Button variant="ghost" size="icon" disabled={uploadingFiles > 0}>
              {uploadingFiles > 0 ? <LoaderCircle className="animate-spin" /> : <ImageUp />}
            </Button>
          </Uploader>
          {/* I'm not sure why, but after triggering the virtual keyboard,
              opening the emoji picker drawer causes an issue,
              the emoji I tap isn't the one that gets inserted. */}
          {!isTouchDevice() && (
            <EmojiPickerDialog onEmojiClick={(emoji) => textareaRef.current?.insertText(emoji)}>
              <Button variant="ghost" size="icon">
                <Smile />
              </Button>
            </EmojiPickerDialog>
          )}
          {!parentEvent && (
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
              {parentEvent ? t('Reply') : t('Post')}
            </Button>
          </div>
        </div>
      </div>
      <PostOptions
        show={showMoreOptions}
        addClientTag={addClientTag}
        setAddClientTag={setAddClientTag}
        isNsfw={isNsfw}
        setIsNsfw={setIsNsfw}
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
          {parentEvent ? t('Reply') : t('Post')}
        </Button>
      </div>
    </div>
  )
}
