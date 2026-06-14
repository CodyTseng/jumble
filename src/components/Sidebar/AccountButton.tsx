import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { toWallet } from '@/lib/link'
import { isPomegranateAccountByPointer } from '@/lib/pomegranate'
import { cn } from '@/lib/utils'
import { useSecondaryPage } from '@/PageManager'
import { useNostr } from '@/providers/NostrProvider'
import { Check, LogIn, LogOut, Plus, Wallet } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import LoginDialog from '../LoginDialog'
import LogoutDialog from '../LogoutDialog'
import SignerTypeBadge from '../SignerTypeBadge'
import { SimpleUserAvatar } from '../UserAvatar'
import { SimpleUsername } from '../Username'
import SidebarItem from './SidebarItem'

export default function AccountButton({ collapse }: { collapse: boolean }) {
  const { pubkey } = useNostr()

  if (pubkey) {
    return <ProfileButton collapse={collapse} />
  } else {
    return <LoginButton collapse={collapse} />
  }
}

function ProfileButton({ collapse }: { collapse: boolean }) {
  const { t } = useTranslation()
  const { account, accounts, switchAccount } = useNostr()
  const pubkey = account?.pubkey
  const { push } = useSecondaryPage()
  const [loginDialogOpen, setLoginDialogOpen] = useState(false)
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false)
  if (!pubkey) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className={cn(
            'clickable text-foreground hover:text-accent-foreground flex items-center justify-start gap-4 rounded-lg bg-transparent p-2 text-lg font-semibold shadow-none',
            collapse ? 'h-12 w-12' : 'h-auto w-full'
          )}
        >
          <div className={cn('flex w-0 flex-1 items-center gap-2', collapse && 'justify-center')}>
            <SimpleUserAvatar size="medium" userId={pubkey} ignorePolicy />
            {!collapse && (
              <SimpleUsername className="truncate text-lg font-semibold" userId={pubkey} />
            )}
          </div>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" className="w-72">
        <DropdownMenuItem onClick={() => push(toWallet())}>
          <Wallet />
          {t('Wallet')}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>{t('Switch account')}</DropdownMenuLabel>
        {accounts.map((act, idx) => {
          const isCurrent = act.pubkey === pubkey
          return (
            <DropdownMenuItem
              key={`${act.pubkey}:${act.signerType}`}
              className={cn(
                'gap-2',
                idx < accounts.length - 1 && 'mb-1',
                isCurrent &&
                  'bg-primary/10 ring-primary/40 focus:bg-primary/10 cursor-default ring-1 ring-inset'
              )}
              onClick={() => {
                if (!isCurrent) {
                  switchAccount(act)
                }
              }}
            >
              <SimpleUserAvatar userId={act.pubkey} ignorePolicy />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <SimpleUsername
                    userId={act.pubkey}
                    className="truncate font-medium"
                    skeletonClassName="h-3"
                  />
                  {isCurrent && (
                    <Check className="text-primary size-3.5 shrink-0" aria-label={t('Current')} />
                  )}
                </div>
                <SignerTypeBadge
                  signerType={act.signerType}
                  isPomegranate={isPomegranateAccountByPointer(act)}
                />
              </div>
            </DropdownMenuItem>
          )
        })}
        <DropdownMenuItem
          onClick={() => setLoginDialogOpen(true)}
          className="focus:border-muted-foreground focus:bg-background m-2 border border-dashed"
        >
          <div className="flex w-full items-center justify-center gap-2 py-2">
            <Plus />
            {t('Add an Account')}
          </div>
        </DropdownMenuItem>
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          onClick={() => setLogoutDialogOpen(true)}
        >
          <LogOut />
          <span className="shrink-0">{t('Logout')}</span>
          <SimpleUsername
            userId={pubkey}
            className="border-muted-foreground text-muted-foreground truncate rounded-md border px-1 text-xs"
          />
        </DropdownMenuItem>
      </DropdownMenuContent>
      <LoginDialog open={loginDialogOpen} setOpen={setLoginDialogOpen} />
      <LogoutDialog open={logoutDialogOpen} setOpen={setLogoutDialogOpen} />
    </DropdownMenu>
  )
}

function LoginButton({ collapse }: { collapse: boolean }) {
  const { checkLogin } = useNostr()

  return (
    <SidebarItem onClick={() => checkLogin()} title="Login" collapse={collapse}>
      <LogIn />
    </SidebarItem>
  )
}
