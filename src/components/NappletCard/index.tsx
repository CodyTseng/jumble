import { useSecondaryPage } from '@/PageManager'
import { getNoteBech32Id } from '@/lib/event'
import { toNapplet } from '@/lib/link'
import { nappletTitle, nappletDescription } from '@/lib/napplet'
import { cn } from '@/lib/utils'
import NappletIcon from './Icon'
import type { Event } from 'nostr-tools'
import { useTranslation } from 'react-i18next'

export default function NappletCard({ event, className }: { event: Event; className?: string }) {
  const { push } = useSecondaryPage()
  const { t } = useTranslation()
  const href = toNapplet(getNoteBech32Id(event))
  const requirements = event.tags.filter((tag) => tag[0] === 'R').map((tag) => tag[1])
  return (
    <div className={cn('group relative rounded-xl border', className)}>
      <a
        href={href}
        aria-label={`${t('Open napplet')}: ${nappletTitle(event)}`}
        className={cn(
          'clickable group-hover:bg-accent/30 focus-visible:ring-ring block space-y-3 rounded-xl p-4 text-start transition-colors focus-visible:ring-2 focus-visible:outline-hidden'
        )}
        onClick={(e) => {
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
          e.preventDefault()
          push(href)
        }}
      >
        <div className="flex items-center gap-3">
          <NappletIcon event={event} />
          <div className="min-w-0">
            <div dir="auto" className="truncate font-semibold">
              {nappletTitle(event)}
            </div>
            <div className="text-muted-foreground text-xs">Napplet</div>
          </div>
        </div>
        <p dir="auto" className="line-clamp-3 text-sm break-words whitespace-pre-wrap">
          {nappletDescription(event)}
        </p>
        {requirements.length > 0 && (
          <p className="text-muted-foreground text-xs break-words">
            {t('Required capabilities')}: {requirements.join(', ')}
          </p>
        )}
      </a>
    </div>
  )
}
