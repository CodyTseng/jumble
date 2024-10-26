import { Event } from 'nostr-tools'
import { formatTimestamp } from '@renderer/lib/timestamp'
import { toNoStrudelNote } from '@renderer/lib/url'
import { kinds } from 'nostr-tools'
import Content from '../Content'
import UserAvatar from '../UserAvatar'
import Username from '../Username'

export default function Note({ event }: { event: Event }) {
  return (
    <div>
      <div className="flex items-center space-x-2">
        <UserAvatar userId={event.pubkey} />
        <div className="flex-1 w-0">
          <Username userId={event.pubkey} className="text-sm font-semibold max-w-fit flex" />
          <div className="text-xs text-muted-foreground">{formatTimestamp(event.created_at)}</div>
        </div>
      </div>
      {[kinds.ShortTextNote].includes(event.kind) ? (
        <Content className="mt-2" event={event} />
      ) : (
        <a
          href={toNoStrudelNote(event.id)}
          target="_blank"
          className="text-highlight hover:underline"
          rel="noreferrer"
        >
          view on noStrudel
        </a>
      )}
    </div>
  )
}
