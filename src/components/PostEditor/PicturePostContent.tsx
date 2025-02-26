import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { createPictureNoteDraftEvent } from '@/lib/draft-event'
import { cn } from '@/lib/utils'
import { useNostr } from '@/providers/NostrProvider'
import { ChevronDown, Loader, LoaderCircle, Plus, X } from 'lucide-react'
import { Dispatch, SetStateAction, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Image from '../Image'
import TextareaWithMentions from '../TextareaWithMentions.tsx'
import Mentions from './Mentions'
import PostOptions from './PostOptions.tsx'
import SendOnlyToSwitch from './SendOnlyToSwitch.tsx'
import Uploader from './Uploader'

export default function PicturePostContent({ close }: { close: () => void }) {
  const { t } = useTranslation()
  const { toast } = useToast()
  const { publish, checkLogin } = useNostr()
  const [content, setContent] = useState('')
  const [pictureInfos, setPictureInfos] = useState<{ url: string; tags: string[][] }[]>([])
  const [posting, setPosting] = useState(false)
  const [showMoreOptions, setShowMoreOptions] = useState(false)
  const [addClientTag, setAddClientTag] = useState(false)
  const [mentions, setMentions] = useState<string[]>([])
  const [specifiedRelayUrls, setSpecifiedRelayUrls] = useState<string[] | undefined>(undefined)
  const canPost = !!content && !posting && pictureInfos.length > 0

  const post = async (e: React.MouseEvent) => {
    e.stopPropagation()
    checkLogin(async () => {
      if (!canPost) {
        close()
        return
      }

      setPosting(true)
      try {
        if (!pictureInfos.length) {
          throw new Error(t('Picture note requires images'))
        }
        const draftEvent = await createPictureNoteDraftEvent(content, pictureInfos, mentions, {
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
      <div className="text-xs text-muted-foreground">
        {t('A special note for picture-first clients like Olas')}
      </div>
      <PictureUploader pictureInfos={pictureInfos} setPictureInfos={setPictureInfos} />
      <TextareaWithMentions
        className="h-32"
        setTextValue={setContent}
        textValue={content}
        placeholder={t('Write something...')}
      />
      <SendOnlyToSwitch
        specifiedRelayUrls={specifiedRelayUrls}
        setSpecifiedRelayUrls={setSpecifiedRelayUrls}
      />
      <div className="flex items-center justify-between">
        <Button
          variant="link"
          className="text-foreground gap-0 px-0"
          onClick={() => setShowMoreOptions((pre) => !pre)}
        >
          {t('More options')}
          <ChevronDown className={`transition-transform ${showMoreOptions ? 'rotate-180' : ''}`} />
        </Button>
        <div className="flex gap-2 items-center">
          <Mentions content={content} mentions={mentions} setMentions={setMentions} />
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
              {t('Post')}
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
          {t('Post')}
        </Button>
      </div>
    </div>
  )
}

function PictureUploader({
  pictureInfos,
  setPictureInfos
}: {
  pictureInfos: { url: string; tags: string[][] }[]
  setPictureInfos: Dispatch<
    SetStateAction<
      {
        url: string
        tags: string[][]
      }[]
    >
  >
}) {
  const [uploading, setUploading] = useState(false)

  return (
    <div className="grid grid-cols-3 gap-4">
      {pictureInfos.map(({ url }, index) => (
        <div className="relative" key={`${index}-${url}`}>
          <Image image={{ url }} className="aspect-square w-full rounded-lg" />
          <Button
            variant="destructive"
            className="absolute top-0 right-0 translate-x-1/2 -translate-y-1/2 rounded-full w-6 h-6 p-0"
            onClick={() => {
              setPictureInfos((prev) => prev.filter((_, i) => i !== index))
            }}
          >
            <X />
          </Button>
        </div>
      ))}
      <Uploader
        onUploadSuccess={({ url, tags }) => {
          setPictureInfos((prev) => [...prev, { url, tags }])
        }}
        onUploadingChange={setUploading}
      >
        <div
          className={cn(
            'flex flex-col gap-2 items-center justify-center aspect-square w-full rounded-lg border border-dashed',
            uploading ? 'cursor-not-allowed text-muted-foreground' : 'clickable'
          )}
        >
          {uploading ? <Loader size={36} className="animate-spin" /> : <Plus size={36} />}
        </div>
      </Uploader>
    </div>
  )
}
