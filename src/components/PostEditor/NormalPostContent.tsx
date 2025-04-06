import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { createCommentDraftEvent, createShortTextNoteDraftEvent } from '@/lib/draft-event'
import { useNostr } from '@/providers/NostrProvider'
import postContentCache from '@/services/post-content-cache.service'
import { ChevronDown, ImageUp, LoaderCircle } from 'lucide-react'
import { Event, kinds } from 'nostr-tools'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import TextareaWithMentions from '../TextareaWithMentions'
import Mentions from './Mentions'
import PostOptions from './PostOptions'
import Preview from './Preview'
import SendOnlyToSwitch from './SendOnlyToSwitch'
import Uploader from './Uploader'
import { preprocessContent } from './utils'
import Note from '@/components/Note'
import { ScrollArea } from "@/components/ui/scroll-area"


export default function NormalPostContent({
  defaultContent = '',
  parentEvent,
  close
}: {
  defaultContent?: string
  parentEvent?: Event
  close: () => void
}) {
  const { t } = useTranslation()
  const { toast } = useToast()
  const { publish, checkLogin } = useNostr()
  const [content, setContent] = useState('')
  const [processedContent, setProcessedContent] = useState('')
  const [pictureInfos, setPictureInfos] = useState<{ url: string; tags: string[][] }[]>([])
  const [posting, setPosting] = useState(false)
  const [showMoreOptions, setShowMoreOptions] = useState(false)
  const [addClientTag, setAddClientTag] = useState(false)
  const [specifiedRelayUrls, setSpecifiedRelayUrls] = useState<string[] | undefined>(undefined)
  const [uploadingPicture, setUploadingPicture] = useState(false)
  const [mentions, setMentions] = useState<string[]>([])
  const [cursorOffset, setCursorOffset] = useState(0)
  const initializedRef = useRef(false)
  const canPost = !!content && !posting

  useEffect(() => {
    const cached = postContentCache.getNormalPostCache({ defaultContent, parentEvent })
    if (cached) {
      setContent(cached.content || '')
      setPictureInfos(cached.pictureInfos || [])
    }
    if (defaultContent) {
      setCursorOffset(defaultContent.length)
    }
    setTimeout(() => {
      initializedRef.current = true
    }, 100)
  }, [defaultContent, parentEvent])

  useEffect(() => {
    setProcessedContent(preprocessContent(content))
    if (!initializedRef.current) return
    postContentCache.setNormalPostCache({ defaultContent, parentEvent }, content, pictureInfos)
  }, [content, pictureInfos])

  const post = async (e: React.MouseEvent) => {
    e.stopPropagation()
    checkLogin(async () => {
      if (!canPost) {
        close()
        return
      }

      setPosting(true)
      try {
        const draftEvent =
          parentEvent && parentEvent.kind !== kinds.ShortTextNote
            ? await createCommentDraftEvent(processedContent, parentEvent, pictureInfos, mentions, {
                addClientTag,
                protectedEvent: !!specifiedRelayUrls
              })
            : await createShortTextNoteDraftEvent(processedContent, pictureInfos, mentions, {
                parentEvent,
                addClientTag,
                protectedEvent: !!specifiedRelayUrls
              })
        await publish(draftEvent, { specifiedRelayUrls })
        setContent('')
        close()
      } catch (error) {
        if (error instanceof AggregateError) {
          error.errors.forEach((e) =>
            toast({
              variant: 'destructive',
              title: t('Failed to post'),
              description: e.message
            })
          )
        } else if (error instanceof Error) {
          toast({
            variant: 'destructive',
            title: t('Failed to post'),
            description: error.message
          })
        }
        console.error(error)
        return
      } finally {
        setPosting(false)
      }
      toast({
        title: t('Post successful'),
        description: t('Your post has been published')
      })
    })
  }

  return (
    <div className="space-y-4">
    {parentEvent && (
    <ScrollArea className="max-h-48 rounded-lg border bg-muted/40 overflow-y-auto">
    <div className="p-2 sm:p-3 pointer-events-none">
      <Note size="small" event={parentEvent} hideStats hideParentNotePreview />
    </div>
  </ScrollArea>
  )}
      <TextareaWithMentions
        className="h-32"
        setTextValue={setContent}
        textValue={content}
        placeholder={t('Write something...')}
        cursorOffset={cursorOffset}
      />
      {processedContent && <Preview content={processedContent} />}
      <SendOnlyToSwitch
        parentEvent={parentEvent}
        specifiedRelayUrls={specifiedRelayUrls}
        setSpecifiedRelayUrls={setSpecifiedRelayUrls}
      />
      <div className="flex items-center justify-between">
        <div className="flex gap-2 items-center">
          <Uploader
            onUploadSuccess={({ url, tags }) => {
              setPictureInfos((prev) => [...prev, { url, tags }])
              setContent((prev) => `${prev}\n${url}`)
            }}
            onUploadingChange={setUploadingPicture}
            accept="image/*,video/*,audio/*"
          >
            <Button variant="secondary" disabled={uploadingPicture}>
              {uploadingPicture ? <LoaderCircle className="animate-spin" /> : <ImageUp />}
            </Button>
          </Uploader>
          <Button
            variant="link"
            className="text-foreground gap-0 px-0"
            onClick={() => setShowMoreOptions((pre) => !pre)}
          >
            {t('More options')}
            <ChevronDown
              className={`transition-transform ${showMoreOptions ? 'rotate-180' : ''}`}
            />
          </Button>
        </div>
        <div className="flex gap-2 items-center">
          <Mentions
            content={processedContent}
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
