import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { formatPubkey } from '@/lib/pubkey'
import { cn } from '@/lib/utils'
import { useNostr } from '@/providers/NostrProvider'
import { Check, ChevronDown, VenetianMask } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { SimpleUserAvatar } from '../UserAvatar'
import { SimpleUsername } from '../Username'

export type TAuthorChoice = 'self' | 'anonymous'

export default function AuthorPicker({
  value,
  onChange
}: {
  value: TAuthorChoice
  onChange: (choice: TAuthorChoice) => void
}) {
  const { t } = useTranslation()
  const { account } = useNostr()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={t('Posting as')}
          className="clickable flex h-8 shrink-0 items-center gap-1 rounded-full p-0.5 transition-colors hover:bg-accent"
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.preventDefault()}
        >
          {value === 'anonymous' || !account ? (
            <AnonymousAvatar />
          ) : (
            <SimpleUserAvatar userId={account.pubkey} size="small" ignorePolicy />
          )}
          <ChevronDown className="size-3.5 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="min-w-64 max-w-80"
        onClick={(e) => e.stopPropagation()}
      >
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
          {t('Posting as')}
        </DropdownMenuLabel>
        {account && (
          <DropdownMenuItem onSelect={() => onChange('self')} className="gap-2">
            <SimpleUserAvatar userId={account.pubkey} size="small" ignorePolicy />
            <div className="min-w-0 flex-1">
              <SimpleUsername
                userId={account.pubkey}
                className="block truncate text-sm font-medium"
              />
              <div className="truncate text-xs text-muted-foreground">
                {formatPubkey(account.pubkey)}
              </div>
            </div>
            {value === 'self' && (
              <Check className="size-4 shrink-0 text-primary" aria-label={t('Selected')} />
            )}
          </DropdownMenuItem>
        )}
        {account && <DropdownMenuSeparator />}
        <DropdownMenuItem onSelect={() => onChange('anonymous')} className="gap-2">
          <AnonymousAvatar />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{t('Anonymous')}</div>
            <div className="truncate text-xs text-muted-foreground">
              {t('Post with a one-off ephemeral key')}
            </div>
          </div>
          {value === 'anonymous' && (
            <Check className="size-4 shrink-0 text-primary" aria-label={t('Selected')} />
          )}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function AnonymousAvatar() {
  return (
    <div
      className={cn(
        'flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground'
      )}
    >
      <VenetianMask className="size-4" />
    </div>
  )
}
