import { Button } from '@/components/ui/button'
import { Drawer, DrawerContent, DrawerOverlay } from '@/components/ui/drawer'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { pubkeyToNpub } from '@/lib/pubkey'
import { useMuteList } from '@/providers/MuteListProvider'
import { useNostr } from '@/providers/NostrProvider'
import { useScreenSize } from '@/providers/ScreenSizeProvider'
import { Bell, BellOff, Copy, Ellipsis } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

export default function ProfileOptions({ pubkey }: { pubkey: string }) {
  const { t } = useTranslation()
  const { isSmallScreen } = useScreenSize()
  const { pubkey: accountPubkey } = useNostr()
  const { mutePubkeySet, mutePubkeyPrivately, mutePubkeyPublicly, unmutePubkey } = useMuteList()
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const isMuted = useMemo(() => mutePubkeySet.has(pubkey), [mutePubkeySet, pubkey])

  if (pubkey === accountPubkey) return null

  const trigger = (
    <Button
      variant="secondary"
      size="icon"
      className="rounded-full"
      onClick={() => {
        if (isSmallScreen) {
          setIsDrawerOpen(true)
        }
      }}
    >
      <Ellipsis />
    </Button>
  )

  if (isSmallScreen) {
    return (
      <>
        {trigger}
        <Drawer open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
          <DrawerOverlay onClick={() => setIsDrawerOpen(false)} />
          <DrawerContent hideOverlay>
            <div className="py-2">
              <Button
                onClick={() => {
                  setIsDrawerOpen(false)
                  navigator.clipboard.writeText(pubkeyToNpub(pubkey) ?? '')
                }}
                className="w-full p-6 justify-start text-lg gap-4 [&_svg]:size-5"
                variant="ghost"
              >
                <Copy />
                {t('Copy user ID')}
              </Button>
              {accountPubkey ? (
                isMuted ? (
                  <Button
                    onClick={() => {
                      setIsDrawerOpen(false)
                      unmutePubkey(pubkey)
                    }}
                    className="w-full p-6 justify-start text-lg gap-4 [&_svg]:size-5 text-destructive focus:text-destructive"
                    variant="ghost"
                  >
                    <Bell />
                    {t('Unmute user')}
                  </Button>
                ) : (
                  <>
                    <Button
                      onClick={() => {
                        setIsDrawerOpen(false)
                        mutePubkeyPrivately(pubkey)
                      }}
                      className="w-full p-6 justify-start text-lg gap-4 [&_svg]:size-5 text-destructive focus:text-destructive"
                      variant="ghost"
                    >
                      <BellOff />
                      {t('Mute user privately')}
                    </Button>
                    <Button
                      onClick={() => {
                        setIsDrawerOpen(false)
                        mutePubkeyPublicly(pubkey)
                      }}
                      className="w-full p-6 justify-start text-lg gap-4 [&_svg]:size-5 text-destructive focus:text-destructive"
                      variant="ghost"
                    >
                      <BellOff />
                      {t('Mute user publicly')}
                    </Button>
                  </>
                )
              ) : null}
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
        <DropdownMenuItem onClick={() => navigator.clipboard.writeText(pubkeyToNpub(pubkey) ?? '')}>
          <Copy />
          {t('Copy user ID')}
        </DropdownMenuItem>
        {accountPubkey ? (
          isMuted ? (
            <DropdownMenuItem
              onClick={() => unmutePubkey(pubkey)}
              className="text-destructive focus:text-destructive"
            >
              <Bell />
              {t('Unmute user')}
            </DropdownMenuItem>
          ) : (
            <>
              <DropdownMenuItem
                onClick={() => mutePubkeyPrivately(pubkey)}
                className="text-destructive focus:text-destructive"
              >
                <BellOff />
                {t('Mute user privately')}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => mutePubkeyPublicly(pubkey)}
                className="text-destructive focus:text-destructive"
              >
                <BellOff />
                {t('Mute user publicly')}
              </DropdownMenuItem>
            </>
          )
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
