import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Modal, ModalContent } from '@/components/ui/modal'
import { pubkeyToNpub } from '@/lib/pubkey'
import { useMuteList } from '@/providers/MuteListProvider'
import { useNostr } from '@/providers/NostrProvider'
import { useScreenSize } from '@/providers/ScreenSizeProvider'
import { Bell, BellOff, Copy, Ellipsis } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

export default function ProfileOptions({
  pubkey,
  variant = 'secondary',
  size = 'icon',
  triggerStyle = 'default'
}: {
  pubkey: string
  variant?: 'secondary' | 'ghost'
  size?: 'icon' | 'titlebar-icon'
  triggerStyle?: 'default' | 'note-options'
}) {
  const { t } = useTranslation()
  const { isSmallScreen } = useScreenSize()
  const { pubkey: accountPubkey } = useNostr()
  const { mutePubkeySet, mutePubkeyPrivately, mutePubkeyPublicly, unmutePubkey } = useMuteList()
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const isMuted = useMemo(() => mutePubkeySet.has(pubkey), [mutePubkeySet, pubkey])

  if (pubkey === accountPubkey) return null

  const trigger =
    triggerStyle === 'note-options' ? (
      <button
        className="text-muted-foreground hover:text-foreground flex h-full cursor-pointer items-center ps-2"
        onClick={() => setIsDrawerOpen(true)}
      >
        <Ellipsis className="size-5" />
      </button>
    ) : (
      <Button
        variant={variant}
        size={size}
        className={variant === 'secondary' ? 'rounded-full' : undefined}
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
        <Modal open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
          <ModalContent title={t('Profile options')}>
            <div className="py-2">
              <Button
                onClick={() => {
                  setIsDrawerOpen(false)
                  navigator.clipboard.writeText(pubkeyToNpub(pubkey) ?? '')
                }}
                className="w-full justify-start gap-4 p-6 text-lg [&_svg]:size-5"
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
                    className="text-destructive focus:text-destructive w-full justify-start gap-4 p-6 text-lg [&_svg]:size-5"
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
                      className="text-destructive focus:text-destructive w-full justify-start gap-4 p-6 text-lg [&_svg]:size-5"
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
                      className="text-destructive focus:text-destructive w-full justify-start gap-4 p-6 text-lg [&_svg]:size-5"
                      variant="ghost"
                    >
                      <BellOff />
                      {t('Mute user publicly')}
                    </Button>
                  </>
                )
              ) : null}
            </div>
          </ModalContent>
        </Modal>
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
