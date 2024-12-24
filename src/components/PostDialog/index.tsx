import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { StorageKey } from '@/constants'
import { useToast } from '@/hooks/use-toast'
import { createShortTextNoteDraftEvent } from '@/lib/draft-event'
import { useNostr } from '@/providers/NostrProvider'
import client from '@/services/client.service'
import { ChevronDown, LoaderCircle } from 'lucide-react'
import { Event } from 'nostr-tools'
import { Dispatch, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import UserAvatar from '../UserAvatar'
import Mentions from './Metions'
import Preview from './Preview'
import Uploader from './Uploader'

export default function PostDialog({
  defaultContent = '',
  parentEvent,
  open,
  setOpen
}: {
  defaultContent?: string
  parentEvent?: Event
  open: boolean
  setOpen: Dispatch<boolean>
}) {
  const { t } = useTranslation()
  const { toast } = useToast()
  const { publish, checkLogin } = useNostr()
  const [content, setContent] = useState(defaultContent)
  const [posting, setPosting] = useState(false)
  const [showMoreOptions, setShowMoreOptions] = useState(false)
  const [addClientTag, setAddClientTag] = useState(false)
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
        setOpen(false)
        return
      }

      setPosting(true)
      try {
        const additionalRelayUrls: string[] = []
        if (parentEvent) {
          const relayList = await client.fetchRelayList(parentEvent.pubkey)
          additionalRelayUrls.push(...relayList.read.slice(0, 5))
        }
        const draftEvent = await createShortTextNoteDraftEvent(content, {
          parentEvent,
          addClientTag
        })
        await publish(draftEvent, additionalRelayUrls)
        setContent('')
        setOpen(false)
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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="p-0" withoutClose>
        <ScrollArea className="px-4 h-full max-h-screen">
          <div className="space-y-4 px-2 py-6">
            <DialogHeader>
              <DialogTitle>
                {parentEvent ? (
                  <div className="flex gap-2 items-center max-w-full">
                    <div className="shrink-0">{t('Reply to')}</div>
                    <UserAvatar userId={parentEvent.pubkey} size="tiny" />
                    <div className="truncate">{parentEvent.content}</div>
                  </div>
                ) : (
                  t('New post')
                )}
              </DialogTitle>
              <DialogDescription className="hidden" />
            </DialogHeader>
            <Textarea
              className="h-32"
              onChange={handleTextareaChange}
              value={content}
              placeholder={t('Write something...')}
            />
            {content && <Preview content={content} />}
            <div className="flex items-center justify-between">
              <div className="flex gap-2 items-center">
                <Uploader setContent={setContent} />
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
                <Button
                  variant="secondary"
                  onClick={(e) => {
                    e.stopPropagation()
                    setOpen(false)
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
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
