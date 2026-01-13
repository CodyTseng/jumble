import { Button } from '@/components/ui/button'
import { getFollowPackInfoFromEvent } from '@/lib/event-metadata'
import { toFollowPack } from '@/lib/link'
import { useSecondaryPage } from '@/PageManager'
import { Event } from 'nostr-tools'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import Image from '../Image'

export default function FollowPack({ event, className }: { event: Event; className?: string }) {
  const { t } = useTranslation()
  const { push } = useSecondaryPage()
  const { title, description, image, pubkeys } = useMemo(
    () => getFollowPackInfoFromEvent(event),
    [event]
  )

  const handleViewDetails = (e: React.MouseEvent) => {
    e.stopPropagation()
    push(toFollowPack(event))
  }

  return (
    <div className={className}>
      <div className="flex items-start gap-2 mb-2">
        {image && (
          <Image
            image={{ url: image, pubkey: event.pubkey }}
            className="w-24 h-20 object-cover"
            classNames={{
              wrapper: 'w-24 h-20 flex-shrink-0',
              errorPlaceholder: 'w-24 h-20'
            }}
            hideIfError
          />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-xl font-semibold mb-1 truncate">{title}</h3>
            <span className="text-xs text-muted-foreground shrink-0">
              {t('n users', { count: pubkeys.length })}
            </span>
          </div>
          {description && (
            <p className="text-sm text-muted-foreground line-clamp-2">{description}</p>
          )}
        </div>
      </div>

      <Button onClick={handleViewDetails} variant="outline" className="w-full">
        {t('View Details')}
      </Button>
    </div>
  )
}
