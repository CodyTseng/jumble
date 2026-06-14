import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { isSameAccount } from '@/lib/account'
import { isPomegranateAccountByPointer } from '@/lib/pomegranate'
import { formatPubkey } from '@/lib/pubkey'
import { cn } from '@/lib/utils'
import { useNostr } from '@/providers/NostrProvider'
import { TAccountPointer } from '@/types'
import { Check, Loader, MoreHorizontal, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation()
  const { accounts, account, switchAccount, removeAccount } = useNostr()
  const [switchingAccount, setSwitchingAccount] = useState<TAccountPointer | null>(null)

  return (
    <div className={cn('space-y-1', className)}>
      {accounts.map((act) => {
        const isCurrent = isSameAccount(act, account)
        return (
          <div
            key={`${act.pubkey}-${act.signerType}`}
            role={isCurrent ? undefined : 'button'}
            aria-current={isCurrent || undefined}
            className={cn(
              'relative flex items-center gap-3 overflow-hidden rounded-lg p-2 transition-colors',
              isCurrent
                ? 'bg-primary/10 ring-primary/40 ring-1 ring-inset'
                : 'clickable hover:bg-accent/50'
            )}
            onClick={() => {
              if (isCurrent) return
              setSwitchingAccount(act)
              switchAccount(act)
                .then(() => afterSwitch())
                .finally(() => setSwitchingAccount(null))
            }}
          >
            <SimpleUserAvatar userId={act.pubkey} ignorePolicy className="shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <SimpleUsername userId={act.pubkey} className="truncate text-sm font-semibold" />
                {isCurrent && (
                  <Check className="text-primary size-3.5 shrink-0" aria-label={t('Current')} />
                )}
              </div>
              <div className="text-muted-foreground truncate text-xs">
                {formatPubkey(act.pubkey)}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <SignerTypeBadge
                signerType={act.signerType}
                isPomegranate={isPomegranateAccountByPointer(act)}
              />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label={t('Account actions')}
                    onClick={(e) => e.stopPropagation()}
                    className="clickable text-muted-foreground hover:bg-accent hover:text-foreground flex size-7 items-center justify-center rounded-md"
                  >
                    <MoreHorizontal className="size-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onSelect={() => removeAccount(act)}
                  >
                    <Trash2 />
                    {t('Remove account')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            {switchingAccount && isSameAccount(act, switchingAccount) && (
              <div className="bg-background/70 absolute inset-0 flex items-center justify-center rounded-lg backdrop-blur-sm">
                <Loader size={16} className="animate-spin" />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
