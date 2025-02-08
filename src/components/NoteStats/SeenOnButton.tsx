import { useSecondaryPage } from '@/PageManager'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { toRelay } from '@/lib/link'
import { simplifyUrl } from '@/lib/url'
import client from '@/services/client.service'
import { Server } from 'lucide-react'
import { Event } from 'nostr-tools'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

export default function SeenOnButton({ event }: { event: Event }) {
  const { t } = useTranslation()
  const { push } = useSecondaryPage()
  const [relays, setRelays] = useState<string[]>([])

  useEffect(() => {
    const seenOn = client.getSeenEventRelayUrls(event.id)
    setRelays(seenOn)
  }, [])

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="flex gap-1 items-center text-muted-foreground enabled:hover:text-primary"
          title={t('Seen on')}
          disabled={relays.length === 0}
        >
          <Server size={16} />
          {relays.length > 0 && <div className="text-sm">{relays.length}</div>}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent collisionPadding={8}>
        <DropdownMenuLabel>Seen on</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {relays.map((relay) => (
          <DropdownMenuItem key={relay} onClick={() => push(toRelay(relay))}>
            {simplifyUrl(relay)}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
