import { FormattedTimestamp } from '@/components/FormattedTimestamp'
import UserAvatar from '@/components/UserAvatar'
import Username from '@/components/Username'
import { transformCustomEmojisInContent } from '@/lib/draft-event'
import { createFakeEvent } from '@/lib/event'
import { cn } from '@/lib/utils'
import dayjs from 'dayjs'
import { useMemo } from 'react'
import Content from '../../Content'

export default function Preview({
  content,
  pubkey,
  className
}: {
  content: string
  pubkey?: string
  className?: string
}) {
  const { content: processedContent, emojiTags } = useMemo(
    () => transformCustomEmojisInContent(content),
    [content]
  )
  // Stamp the preview "now" so the relative timestamp reads naturally.
  const createdAt = useMemo(() => dayjs().unix(), [])
  const fakeEvent = useMemo(
    () =>
      createFakeEvent({
        content: processedContent,
        tags: emojiTags,
        pubkey: pubkey ?? '',
        created_at: createdAt
      }),
    [processedContent, emojiTags, pubkey, createdAt]
  )

  return (
    <div className={cn('pointer-events-none px-5 py-2 text-base sm:px-6', className)}>
      {pubkey && (
        <div className="mb-2 flex items-center gap-2">
          <UserAvatar userId={pubkey} size="normal" />
          <div className="w-0 flex-1">
            <Username
              userId={pubkey}
              className="flex truncate font-semibold"
              skeletonClassName="h-4"
            />
            <FormattedTimestamp
              timestamp={createdAt}
              className="text-sm text-muted-foreground"
            />
          </div>
        </div>
      )}
      <Content event={fakeEvent} className="pointer-events-none h-full" mustLoadMedia />
    </div>
  )
}
