import { Event } from 'nostr-tools'
import { useFetchEventById } from '@renderer/hooks'
import { Repeat2 } from 'lucide-react'
import Username from '../Username'
import ShortTextNoteCard from './ShortTextNoteCard'

export default function RepostNoteCard({ event, className }: { event: Event; className?: string }) {
  const targetEventId = event.tags.find(([tagName]) => tagName === 'e')?.[1]
  const targetEvent = useFetchEventById(targetEventId)
  if (!targetEvent) return null

  return (
    <div className={className}>
      <div className="flex gap-1 mb-1 pl-4 text-xs items-center text-muted-foreground">
        <Repeat2 size={12} />
        <Username userId={event.pubkey} className="font-semibold" />
        <div>reposted</div>
      </div>
      <ShortTextNoteCard event={targetEvent} />
    </div>
  )
}
