import { Button } from '@/components/ui/button'
import { isSameAccount } from '@/lib/account'
import { formatPubkey } from '@/lib/pubkey'
import { cn } from '@/lib/utils'
import { useNostr } from '@/providers/NostrProvider'
import { TAccountPointer } from '@/types'
import { Loader, Trash2 } from 'lucide-react'
import { useState } from 'react'
import SignerTypeBadge from '../SignerTypeBadge'
import { SimpleUserAvatar } from '../UserAvatar'
import { SimpleUsername } from '../Username'

export default function AccountList({
  className,
  afterSwitch
}: {
  className?: string
  afterSwitch: () => void
}) {
  const { accounts, account, switchAccount, removeAccount } = useNostr()
  const [switchingAccount, setSwitchingAccount] = useState<TAccountPointer | null>(null)

  return (
    <div className={cn('space-y-2', className)}>
      {accounts.map((act) => (
        <div
          key={`${act.pubkey}-${act.signerType}`}
          className={cn(
            'relative rounded-lg',
            isSameAccount(act, account) ? 'border border-primary' : 'clickable'
          )}
          onClick={() => {
            if (isSameAccount(act, account)) return
            setSwitchingAccount(act)
            switchAccount(act)
              .then(() => afterSwitch())
              .finally(() => setSwitchingAccount(null))
          }}
        >
          <div className="flex items-center justify-between p-2">
            <div className="relative flex flex-1 items-center gap-2">
              <SimpleUserAvatar userId={act.pubkey} ignorePolicy />
              <div className="w-0 flex-1">
                <SimpleUsername userId={act.pubkey} className="truncate font-semibold" />
                <div className="w-fit rounded-full bg-muted px-2 text-sm">
                  {formatPubkey(act.pubkey)}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2">
                <SignerTypeBadge signerType={act.signerType} />
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-destructive"
                onClick={(e) => {
                  e.stopPropagation()
                  removeAccount(act)
                }}
              >
                <Trash2 />
              </Button>
            </div>
          </div>
          {switchingAccount && isSameAccount(act, switchingAccount) && (
            <div className="absolute left-0 top-0 flex h-full w-full items-center justify-center rounded-lg bg-muted/60">
              <Loader size={16} className="animate-spin" />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
