import Image from '@/components/Image'
import { cn } from '@/lib/utils'
import { Heart } from 'lucide-react'
import { Event } from 'nostr-tools'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

export default function ReactionPreview({
  event,
  className
}: {
  event: Event
  className?: string
}) {
  const { t } = useTranslation()

  const reaction = useMemo(() => {
    if (!event.content || event.content === '+') {
      return <Heart size={14} className="inline text-red-400" />
    }

    const emojiName = /^:([^:]+):$/.exec(event.content)?.[1]
    if (emojiName) {
      const emojiTag = event.tags.find((tag) => tag[0] === 'emoji' && tag[1] === emojiName)
      const emojiUrl = emojiTag?.[2]
      if (emojiUrl) {
        return (
          <Image
            image={{ url: emojiUrl, pubkey: event.pubkey }}
            alt={emojiName}
            className="inline-block h-4 w-4"
            classNames={{ errorPlaceholder: 'bg-transparent', wrapper: 'inline-block rounded-md' }}
            errorPlaceholder={<Heart size={14} className="inline text-red-400" />}
          />
        )
      }
    }
    if (event.content.length > 4) {
      return <Heart size={14} className="inline text-red-400" />
    }
    return <span>{event.content}</span>
  }, [event])

  return (
    <div className={cn('flex items-center gap-1 truncate', className)}>
      <span className="truncate">[{t('Reaction')}]</span>
      {reaction}
    </div>
  )
}
