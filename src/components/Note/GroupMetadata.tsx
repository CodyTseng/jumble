import { getGroupMetadata } from '@/lib/event'
import { useScreenSize } from '@/providers/ScreenSizeProvider'
import { Event } from 'nostr-tools'
import { useMemo } from 'react'
import ClientSelect from '../ClientSelect'
import Image from '../Image'

export default function GroupMetadata({
  event,
  originalNoteId,
  className
}: {
  event: Event
  originalNoteId?: string
  className?: string
}) {
  const { isSmallScreen } = useScreenSize()
  const metadata = useMemo(() => {
    return getGroupMetadata(event, originalNoteId)
  }, [event, originalNoteId])

  const groupNameComponent = (
    <div className="text-xl font-semibold line-clamp-1">{metadata.name}</div>
  )

  const groupAboutComponent = metadata.about && (
    <div className="text-sm text-muted-foreground line-clamp-4">{metadata.about}</div>
  )

  if (isSmallScreen) {
    return (
      <div className={className}>
        {metadata.picture && (
          <Image
            image={{ url: metadata.picture }}
            className="w-full aspect-video object-cover rounded-lg"
            hideIfError
          />
        )}
        <div className="space-y-1">
          {groupNameComponent}
          {groupAboutComponent}
          <ClientSelect
            variant="secondary"
            className="w-full mt-2"
            event={event}
            originalNoteId={originalNoteId}
          />
        </div>
      </div>
    )
  }

  return (
    <div className={className}>
      <div className="flex gap-2">
        {metadata.picture && (
          <Image
            image={{ url: metadata.picture }}
            className="rounded-lg aspect-[4/3] xl:aspect-video object-cover bg-foreground h-44"
            hideIfError
          />
        )}
        <div className="flex-1 w-0 space-y-1 px-2">
          {groupNameComponent}
          {groupAboutComponent}
        </div>
      </div>
      <ClientSelect variant="secondary" className="w-full mt-2" event={event} />
    </div>
  )
}
