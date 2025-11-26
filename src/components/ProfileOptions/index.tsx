import { Button } from '@/components/ui/button'
import {
  ResponsiveMenu,
  ResponsiveMenuContent,
  ResponsiveMenuItem,
  ResponsiveMenuTrigger
} from '@/components/ui/responsive-menu'
import { pubkeyToNpub } from '@/lib/pubkey'
import { useMuteList } from '@/providers/MuteListProvider'
import { useNostr } from '@/providers/NostrProvider'
import { Bell, BellOff, Copy, Ellipsis } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

export default function ProfileOptions({ pubkey }: { pubkey: string }) {
  const { t } = useTranslation()
  const { pubkey: accountPubkey } = useNostr()
  const { mutePubkeySet, mutePubkeyPrivately, mutePubkeyPublicly, unmutePubkey } = useMuteList()
  const isMuted = useMemo(() => mutePubkeySet.has(pubkey), [mutePubkeySet, pubkey])

  if (pubkey === accountPubkey) return null

  return (
    <ResponsiveMenu>
      <ResponsiveMenuTrigger asChild>
        <Button variant="secondary" size="icon" className="rounded-full">
          <Ellipsis />
        </Button>
      </ResponsiveMenuTrigger>

      <ResponsiveMenuContent>
        <ResponsiveMenuItem onClick={() => navigator.clipboard.writeText(pubkeyToNpub(pubkey) ?? '')}>
          <Copy />
          {t('Copy user ID')}
        </ResponsiveMenuItem>
        {accountPubkey ? (
          isMuted ? (
            <ResponsiveMenuItem
              onClick={() => unmutePubkey(pubkey)}
              className="text-destructive focus:text-destructive"
            >
              <Bell />
              {t('Unmute user')}
            </ResponsiveMenuItem>
          ) : (
            <>
              <ResponsiveMenuItem
                onClick={() => mutePubkeyPrivately(pubkey)}
                className="text-destructive focus:text-destructive"
              >
                <BellOff />
                {t('Mute user privately')}
              </ResponsiveMenuItem>
              <ResponsiveMenuItem
                onClick={() => mutePubkeyPublicly(pubkey)}
                className="text-destructive focus:text-destructive"
              >
                <BellOff />
                {t('Mute user publicly')}
              </ResponsiveMenuItem>
            </>
          )
        ) : null}
      </ResponsiveMenuContent>
    </ResponsiveMenu>
  )
}
