import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { createCommentDraftEvent, createShortTextNoteDraftEvent } from '@/lib/draft-event'
import { getRootEventTag } from '@/lib/event.ts'
import { useNostr } from '@/providers/NostrProvider'
import client from '@/services/client.service'
import postContentCache from '@/services/post-content-cache.service'
import { ChevronDown, ImageUp, LoaderCircle } from 'lucide-react'
import { Event, kinds, nip19 } from 'nostr-tools'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import TextareaWithMentions from '../TextareaWithMentions.tsx'
import Mentions from './Mentions'
import PostOptions from './PostOptions.tsx'
import Preview from './Preview'
import SendOnlyToSwitch from './SendOnlyToSwitch.tsx'
import Uploader from './Uploader'

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
    const cachedContent = postContentCache.getNormalPostCache({ defaultContent, parentEvent })
    if (cachedContent) {
      setContent(cachedContent)
    }
    if (defaultContent) {
      setCursorOffset(defaultContent.length)
    }
    setTimeout(() => {
      initializedRef.current = true
    }, 100)
  }, [defaultContent, parentEvent])

  useEffect(() => {
    if (!initializedRef.current) return
    postContentCache.setNormalPostCache({ defaultContent, parentEvent }, content)
  }, [content])

  const post = async (e: React.MouseEvent) => {
    e.stopPropagation()
    checkLogin(async () => {
      if (!canPost) {
        close()
        return
      }

      setPosting(true)
      try {
        const additionalRelayUrls: string[] = []
        if (parentEvent && !specifiedRelayUrls) {
          const relayList = await client.fetchRelayList(parentEvent.pubkey)
          additionalRelayUrls.push(...relayList.read.slice(0, 3))
          const rootEventTag = getRootEventTag(parentEvent)
          if (rootEventTag) {
            const [, rootEventId, rootEventRelay, , rootAuthor] = rootEventTag
            if (rootAuthor) {
              if (rootAuthor !== parentEvent.pubkey) {
                const rootAuthorRelayList = await client.fetchRelayList(rootAuthor)
                additionalRelayUrls.push(...rootAuthorRelayList.read.slice(0, 3))
              }
            } else {
              try {
                const rootEvent = await client.fetchEvent(
                  nip19.neventEncode(
                    rootEventRelay
                      ? { id: rootEventId }
                      : { id: rootEventId, relays: [rootEventRelay] }
                  )
                )
                if (rootEvent && rootEvent.pubkey !== parentEvent.pubkey) {
                  const rootAuthorRelayList = await client.fetchRelayList(rootEvent.pubkey)
                  additionalRelayUrls.push(...rootAuthorRelayList.read.slice(0, 3))
                }
              } catch {
                // ignore
              }
            }
          }
        }
        const draftEvent =
          parentEvent && parentEvent.kind !== kinds.ShortTextNote
            ? await createCommentDraftEvent(content, parentEvent, pictureInfos, mentions, {
                addClientTag,
                protectedEvent: !!specifiedRelayUrls
              })
            : await createShortTextNoteDraftEvent(content, pictureInfos, mentions, {
                parentEvent,
                addClientTag,
                protectedEvent: !!specifiedRelayUrls
              })
        await publish(draftEvent, {
          additionalRelayUrls,
          specifiedRelayUrls
        })
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
      <TextareaWithMentions
        className="h-32"
        setTextValue={setContent}
        textValue={content}
        placeholder={t('Write something...')}
        cursorOffset={cursorOffset}
      />
      {content && <Preview content={content} />}
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
            content={content}
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
