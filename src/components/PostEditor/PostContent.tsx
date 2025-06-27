import Note from '@/components/Note'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { createCommentDraftEvent, createShortTextNoteDraftEvent } from '@/lib/draft-event'
import { isTouchDevice } from '@/lib/utils'
import { useNostr } from '@/providers/NostrProvider'
import postContentCache from '@/services/post-content-cache.service'
import { ImageUp, LoaderCircle, Settings, Smile } from 'lucide-react'
import { Event, kinds } from 'nostr-tools'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import EmojiPickerDialog from '../EmojiPickerDialog'
import Mentions from './Mentions'
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
  const { publish, checkLogin } = useNostr()
  const { uploadingFiles, setUploadingFiles } = usePostEditor()
  const [text, setText] = useState('')
  const textareaRef = useRef<TPostTextareaHandle>(null)
  const [posting, setPosting] = useState(false)
  const [showMoreOptions, setShowMoreOptions] = useState(false)
  const [addClientTag, setAddClientTag] = useState(false)
  const [specifiedRelayUrls, setSpecifiedRelayUrls] = useState<string[] | undefined>(undefined)
  const [mentions, setMentions] = useState<string[]>([])
  const [isNsfw, setIsNsfw] = useState(false)
  const canPost = !!text && !posting && !uploadingFiles

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
            : await createShortTextNoteDraftEvent(text, mentions, {
                parentEvent,
                addClientTag,
                protectedEvent: !!specifiedRelayUrls,
                isNsfw
              })
        await publish(draftEvent, { specifiedRelayUrls })
        postContentCache.clearPostCache({ defaultContent, parentEvent })
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
      />
      <SendOnlyToSwitch
        parentEvent={parentEvent}
        specifiedRelayUrls={specifiedRelayUrls}
        setSpecifiedRelayUrls={setSpecifiedRelayUrls}
      />
      <div className="flex items-center justify-between">
        <div className="flex gap-2 items-center">
          <Uploader
            onUploadSuccess={({ url }) => {
              textareaRef.current?.appendText(url)
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
