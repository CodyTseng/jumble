import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { StorageKey } from '@/constants'
import { useToast } from '@/hooks/use-toast'
import { createCommentDraftEvent, createShortTextNoteDraftEvent } from '@/lib/draft-event'
import { useNostr } from '@/providers/NostrProvider'
import client from '@/services/client.service'
import { ChevronDown, ImageUp, LoaderCircle } from 'lucide-react'
import { Event, kinds } from 'nostr-tools'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Mentions from './Mentions'
import Preview from './Preview'
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
  const [content, setContent] = useState(defaultContent)
  const [pictureInfos, setPictureInfos] = useState<{ url: string; tags: string[][] }[]>([])
  const [posting, setPosting] = useState(false)
  const [showMoreOptions, setShowMoreOptions] = useState(false)
  const [addClientTag, setAddClientTag] = useState(false)
  const [uploadingPicture, setUploadingPicture] = useState(false)
  const canPost = !!content && !posting

  useEffect(() => {
    setAddClientTag(window.localStorage.getItem(StorageKey.ADD_CLIENT_TAG) === 'true')
  }, [])

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value)
  }

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
        if (parentEvent) {
          const relayList = await client.fetchRelayList(parentEvent.pubkey)
          additionalRelayUrls.push(...relayList.read.slice(0, 5))
        }
        const draftEvent =
          parentEvent && parentEvent.kind !== kinds.ShortTextNote
            ? await createCommentDraftEvent(content, parentEvent, pictureInfos, { addClientTag })
            : await createShortTextNoteDraftEvent(content, pictureInfos, {
                parentEvent,
                addClientTag
              })
        await publish(draftEvent, additionalRelayUrls)
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

  const onAddClientTagChange = (checked: boolean) => {
    setAddClientTag(checked)
    window.localStorage.setItem(StorageKey.ADD_CLIENT_TAG, checked.toString())
  }

  return (
    <div className="space-y-4">
      <Textarea
        className="h-32"
        onChange={handleTextareaChange}
        value={content}
        placeholder={t('Write something...')}
      />
      {content && <Preview content={content} />}
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
          <Mentions content={content} parentEvent={parentEvent} />
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
      {showMoreOptions && (
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <Label htmlFor="add-client-tag">{t('Add client tag')}</Label>
            <Switch
              id="add-client-tag"
              checked={addClientTag}
              onCheckedChange={onAddClientTagChange}
            />
          </div>
          <div className="text-muted-foreground text-xs">
            {t('Show others this was sent via Jumble')}
          </div>
        </div>
      )}
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
