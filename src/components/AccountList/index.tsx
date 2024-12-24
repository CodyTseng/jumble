import { Badge } from '@/components/ui/badge'
import { isSameAccount } from '@/lib/account'
import { formatPubkey } from '@/lib/pubkey'
import { cn } from '@/lib/utils'
import { useNostr } from '@/providers/NostrProvider'
import { TAccountPointer, TSignerType } from '@/types'
import { Loader, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { SimpleUserAvatar } from '../UserAvatar'
import { SimpleUsername } from '../Username'

export default function AccountList({ afterSwitch }: { afterSwitch: () => void }) {
  const { accounts, account, switchAccount, removeAccount } = useNostr()
  const [switchingAccount, setSwitchingAccount] = useState<TAccountPointer | null>(null)

  return (
    <div className="space-y-2">
      {accounts.map((act) => (
        <div
          key={`${act.pubkey}-${act.signerType}`}
          className={cn(
            'relative rounded-lg',
            isSameAccount(act, account)
              ? 'border border-primary'
              : 'cursor-pointer hover:bg-muted/60'
          )}
          onClick={() => {
            if (isSameAccount(act, account)) return
            setSwitchingAccount(act)
            switchAccount(act)
              .then(() => afterSwitch())
              .finally(() => setSwitchingAccount(null))
          }}
        >
          <div className="flex justify-between items-center p-2">
            <div className="flex items-center gap-2 relative">
              <SimpleUserAvatar userId={act.pubkey} />
              <div>
                <SimpleUsername userId={act.pubkey} className="font-semibold" />
                <div className="text-sm rounded-full bg-muted px-2 w-fit">
                  {formatPubkey(act.pubkey)}
                </div>
              </div>
            </div>
            <div className="flex gap-2 items-center">
              <SignerTypeBadge signerType={act.signerType} />
              <Trash2
                size={16}
                className="text-muted-foreground hover:text-destructive cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation()
                  removeAccount(act)
                }}
              />
            </div>
          </div>
          {switchingAccount && isSameAccount(act, switchingAccount) && (
            <div className="absolute top-0 left-0 flex w-full h-full items-center justify-center rounded-lg bg-muted/60">
              <Loader size={16} className="animate-spin" />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function SignerTypeBadge({ signerType }: { signerType: TSignerType }) {
  if (signerType === 'nip-07') {
    return <Badge className=" bg-green-400 hover:bg-green-400/80">NIP-07</Badge>
  } else if (signerType === 'bunker') {
    return <Badge className=" bg-blue-400 hover:bg-blue-400/80">Bunker</Badge>
  } else {
    return <Badge>NSEC</Badge>
  }
}