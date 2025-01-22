import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { pubkeyToNpub } from '@/lib/pubkey'
import { useMuteList } from '@/providers/MuteListProvider'
import { useNostr } from '@/providers/NostrProvider'
import { Bell, BellOff, Copy, Ellipsis } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export default function ProfileOptions({ pubkey }: { pubkey: string }) {
  const { t } = useTranslation()
  const { pubkey: accountPubkey } = useNostr()
  const { mutePubkeys, mutePubkey, unmutePubkey } = useMuteList()

  if (pubkey === accountPubkey) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary" size="icon" className="rounded-full">
          <Ellipsis className="text-muted-foreground hover:text-foreground cursor-pointer" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent collisionPadding={8}>
        <DropdownMenuItem
          onClick={() => navigator.clipboard.writeText('nostr:' + pubkeyToNpub(pubkey))}
        >
          <Copy />
          {t('copy embedded code')}
        </DropdownMenuItem>
        {mutePubkeys.includes(pubkey) ? (
          <DropdownMenuItem
            onClick={() => unmutePubkey(pubkey)}
            className="text-destructive focus:text-destructive"
          >
            <Bell />
            {t('unmute user')}
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem
            onClick={() => mutePubkey(pubkey)}
            className="text-destructive focus:text-destructive"
          >
            <BellOff />
            {t('mute user')}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
