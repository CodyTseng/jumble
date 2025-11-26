import { useSecondaryPage } from '@/PageManager'
import {
  ResponsiveMenu,
  ResponsiveMenuContent,
  ResponsiveMenuItem,
  ResponsiveMenuLabel,
  ResponsiveMenuSeparator,
  ResponsiveMenuTrigger
} from '@/components/ui/responsive-menu'
import { useStuff } from '@/hooks/useStuff'
import { toRelay } from '@/lib/link'
import { simplifyUrl } from '@/lib/url'
import client from '@/services/client.service'
import { Server } from 'lucide-react'
import { Event } from 'nostr-tools'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import RelayIcon from '../RelayIcon'

export default function SeenOnButton({ stuff }: { stuff: Event | string }) {
  const { t } = useTranslation()
  const { push } = useSecondaryPage()
  const { event } = useStuff(stuff)
  const [relays, setRelays] = useState<string[]>([])

  useEffect(() => {
    if (!event) return

    const seenOn = client.getSeenEventRelayUrls(event.id)
    setRelays(seenOn)
  }, [event])

  if (relays.length === 0) {
    return (
      <button
        className="flex gap-1 items-center text-muted-foreground enabled:hover:text-primary pl-3 h-full disabled:text-muted-foreground/40"
        title={t('Seen on')}
        disabled
      >
        <Server />
      </button>
    )
  }

  return (
    <ResponsiveMenu>
      <ResponsiveMenuTrigger asChild>
        <button
          className="flex gap-1 items-center text-muted-foreground enabled:hover:text-primary pl-3 h-full"
          title={t('Seen on')}
        >
          <Server />
          <div className="text-sm">{relays.length}</div>
        </button>
      </ResponsiveMenuTrigger>

      <ResponsiveMenuContent>
        <ResponsiveMenuLabel>{t('Seen on')}</ResponsiveMenuLabel>
        <ResponsiveMenuSeparator />
        {relays.map((relay) => (
          <ResponsiveMenuItem key={relay} onClick={() => push(toRelay(relay))}>
            <RelayIcon url={relay} />
            {simplifyUrl(relay)}
          </ResponsiveMenuItem>
        ))}
      </ResponsiveMenuContent>
    </ResponsiveMenu>
  )
}
