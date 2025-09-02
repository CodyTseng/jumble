import { Button } from '@/components/ui/button'
import { Drawer, DrawerContent, DrawerTrigger } from '@/components/ui/drawer'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { useMuteList } from '@/providers/MuteListProvider'
import { useNostr } from '@/providers/NostrProvider'
import { useScreenSize } from '@/providers/ScreenSizeProvider'
import { BellOff, Loader } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

export default function MuteButton({ pubkey }: { pubkey: string }) {
  const { t } = useTranslation()
  const { isSmallScreen } = useScreenSize()
  const { pubkey: accountPubkey, checkLogin } = useNostr()
  const { mutePubkeySet, changing, mutePubkeyPrivately, mutePubkeyPublicly, unmutePubkey } =
    useMuteList()
  const [updating, setUpdating] = useState(false)
  const isMuted = useMemo(() => mutePubkeySet.has(pubkey), [mutePubkeySet, pubkey])

  if (!accountPubkey || (pubkey && pubkey === accountPubkey)) return null

  const handleMute = async (e: React.MouseEvent, isPrivate = true) => {
    e.stopPropagation()
    checkLogin(async () => {
      if (isMuted) return

      setUpdating(true)
      try {
        if (isPrivate) {
          await mutePubkeyPrivately(pubkey)
        } else {
          await mutePubkeyPublicly(pubkey)
        }
      } catch (error) {
        toast.error(`${t('Mute failed')}: ${(error as Error).message}`)
      } finally {
        setUpdating(false)
      }
    })
  }

  const handleUnmute = async (e: React.MouseEvent) => {
    e.stopPropagation()
    checkLogin(async () => {
      if (!isMuted) return

      setUpdating(true)
      try {
        await unmutePubkey(pubkey)
      } catch (error) {
        toast.error(`${t('Unmute failed')}: ${(error as Error).message}`)
      } finally {
        setUpdating(false)
      }
    })
  }

  if (isMuted) {
    return (
      <Button
        className="w-20 min-w-20 rounded-full"
        variant="secondary"
        onClick={handleUnmute}
        disabled={updating || changing}
      >
        {updating ? <Loader className="animate-spin" /> : t('Unmute')}
      </Button>
    )
  }

  const trigger = (
    <Button
      variant="destructive"
      className="w-20 min-w-20 rounded-full"
      disabled={updating || changing}
    >
      {updating ? <Loader className="animate-spin" /> : t('Mute')}
    </Button>
  )

  if (isSmallScreen) {
    return (
      <Drawer>
        <DrawerTrigger asChild>{trigger}</DrawerTrigger>
        <DrawerContent>
          <div className="py-2">
            <Button
              className="w-full p-6 justify-start text-destructive text-lg gap-4 [&_svg]:size-5 focus:text-destructive"
              variant="ghost"
              onClick={(e) => handleMute(e, true)}
              disabled={updating || changing}
            >
              {updating ? <Loader className="animate-spin" /> : t('Mute user privately')}
            </Button>
            <Button
              className="w-full p-6 justify-start text-destructive text-lg gap-4 [&_svg]:size-5 focus:text-destructive"
              variant="ghost"
              onClick={(e) => handleMute(e, false)}
              disabled={updating || changing}
            >
              {updating ? <Loader className="animate-spin" /> : t('Mute user publicly')}
            </Button>
          </div>
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem
          onClick={(e) => handleMute(e, true)}
          className="text-destructive focus:text-destructive"
        >
          <BellOff />
          {t('Mute user privately')}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={(e) => handleMute(e, false)}
          className="text-destructive focus:text-destructive"
        >
          <BellOff />
          {t('Mute user publicly')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
