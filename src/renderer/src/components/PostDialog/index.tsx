import { Button } from '@renderer/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@renderer/components/ui/dialog'
import { ScrollArea } from '@renderer/components/ui/scroll-area'
import { Textarea } from '@renderer/components/ui/textarea'
import { useToast } from '@renderer/hooks/use-toast'
import { createShortTextNoteDraftEvent } from '@renderer/lib/draft-event'
import { useNostr } from '@renderer/providers/NostrProvider'
import client from '@renderer/services/client.service'
import { LoaderCircle } from 'lucide-react'
import { Event } from 'nostr-tools'
import { useState } from 'react'
import UserAvatar from '../UserAvatar'
import Mentions from './Metions'
import Preview from './Preview'

export default function PostDialog({
  children,
  parentEvent
}: {
  children: React.ReactNode
  parentEvent?: Event
}) {
  const { toast } = useToast()
  const { pubkey, publish } = useNostr()
  const [open, setOpen] = useState(false)
  const [content, setContent] = useState('')
  const [posting, setPosting] = useState(false)

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value)
  }

  const post = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!content || !pubkey || posting) {
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
      const draftEvent = await createShortTextNoteDraftEvent(content, parentEvent)
      await publish(draftEvent, additionalRelayUrls)
      setContent('')
      setOpen(false)
    } catch (error) {
      if (error instanceof AggregateError) {
        error.errors.forEach((e) =>
          toast({
            variant: 'destructive',
            title: 'Failed to post',
            description: e.message
          })
        )
      } else if (error instanceof Error) {
        toast({
          variant: 'destructive',
          title: 'Failed to post',
          description: error.message
        })
      }
      console.error(error)
      return
    } finally {
      setPosting(false)
    }
    toast({
      title: 'Post successful',
      description: 'Your post has been published'
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="p-0" withoutClose>
        <ScrollArea className="px-4 h-full max-h-screen">
          <div className="space-y-4 px-2 py-6">
            <DialogHeader>
              <DialogTitle>
                {parentEvent ? (
                  <div className="flex gap-2 items-center max-w-full">
                    <div className="shrink-0">Reply to</div>
                    <UserAvatar userId={parentEvent.pubkey} size="tiny" />
                    <div className="truncate">{parentEvent.content}</div>
                  </div>
                ) : (
                  'New post'
                )}
              </DialogTitle>
            </DialogHeader>
            <Textarea
              onChange={handleTextareaChange}
              value={content}
              placeholder="Write something..."
            />
            {content && <Preview content={content} />}
            <DialogFooter className="items-center">
              <Mentions content={content} parentEvent={parentEvent} />
              <Button
                variant="secondary"
                onClick={(e) => {
                  e.stopPropagation()
                  setOpen(false)
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={!pubkey || posting} onClick={post}>
                {posting && <LoaderCircle className="animate-spin" />}
                Post
              </Button>
            </DialogFooter>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
