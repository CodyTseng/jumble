import { useSecondaryPage } from '@/PageManager'
import { Button } from '@/components/ui/button'
import { Drawer, DrawerContent, DrawerOverlay } from '@/components/ui/drawer'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { useStuff } from '@/hooks/useStuff'
import { toRelay } from '@/lib/link'
import { simplifyUrl } from '@/lib/url'
import { useScreenSize } from '@/providers/ScreenSizeProvider'
import client from '@/services/client.service'
import { Server } from 'lucide-react'
import { Event } from 'nostr-tools'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import RelayIcon from '../RelayIcon'

export default function SeenOnButton({ stuff }: { stuff: Event | string }) {
  const { t } = useTranslation()
  const { isSmallScreen } = useScreenSize()
  const { push } = useSecondaryPage()
  const { event } = useStuff(stuff)
  const [relays, setRelays] = useState<string[]>([])
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)

  useEffect(() => {
    if (!event) return

    const seenOn = client.getSeenEventRelayUrls(event.id)
    setRelays(seenOn)
  }, [])

  const trigger = (
    <button
      className="flex gap-1 items-center text-muted-foreground enabled:hover:text-primary pl-3 h-full disabled:text-muted-foreground/40"
      title={t('Seen on')}
      disabled={relays.length === 0}
      onClick={() => {
        if (!event) return

        if (isSmallScreen) {
          setIsDrawerOpen(true)
        }
      }}
    >
      <Server />
      {relays.length > 0 && <div className="text-sm">{relays.length}</div>}
    </button>
  )

  if (relays.length === 0) {
    return trigger
  }

  if (isSmallScreen) {
    return (
      <>
        {trigger}
        <Drawer open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
          <DrawerOverlay onClick={() => setIsDrawerOpen(false)} />
          <DrawerContent hideOverlay>
            <div className="py-2">
              {relays.map((relay) => (
                <Button
                  className="w-full p-6 justify-start text-lg gap-4"
                  variant="ghost"
                  key={relay}
                  onClick={() => {
                    setIsDrawerOpen(false)
                    setTimeout(() => {
                      push(toRelay(relay))
                    }, 50) // Timeout to allow the drawer to close before navigating
                  }}
                >
                  <RelayIcon url={relay} /> {simplifyUrl(relay)}
                </Button>
              ))}
            </div>
          </DrawerContent>
        </Drawer>
      </>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel>{t('Seen on')}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {relays.map((relay) => (
          <DropdownMenuItem key={relay} onClick={() => push(toRelay(relay))} className="min-w-52">
            <RelayIcon url={relay} />
            {simplifyUrl(relay)}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
