import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { StorageKey } from '@/constants'
import { useToast } from '@/hooks/use-toast'
import { createPictureNoteDraftEvent } from '@/lib/draft-event'
import { cn } from '@/lib/utils'
import { useNostr } from '@/providers/NostrProvider'
import { ChevronDown, Loader, LoaderCircle, Plus, X } from 'lucide-react'
import { Dispatch, SetStateAction, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Image from '../Image'
import Mentions from './Mentions'
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
  const canPost = !!content && !posting && pictureInfos.length > 0

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
        if (!pictureInfos.length) {
          throw new Error(t('Picture note requires images'))
        }
        const draftEvent = await createPictureNoteDraftEvent(content, pictureInfos, {
          addClientTag
        })
        await publish(draftEvent)
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
      <div className="text-xs text-muted-foreground">
        {t('A special note for picture-first clients like Olas')}
      </div>
      <PictureUploader pictureInfos={pictureInfos} setPictureInfos={setPictureInfos} />
      <Textarea
        className="h-32"
        onChange={handleTextareaChange}
        value={content}
        placeholder={t('Write something...')}
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
          <Mentions content={content} />
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
