import { Button } from '@/components/ui/button'
import {
  ResponsiveMenu,
  ResponsiveMenuContent,
  ResponsiveMenuItem,
  ResponsiveMenuLabel,
  ResponsiveMenuSeparator,
  ResponsiveMenuTrigger
} from '@/components/ui/responsive-menu'
import { toWallet } from '@/lib/link'
import { cn } from '@/lib/utils'
import { useSecondaryPage } from '@/PageManager'
import { useNostr } from '@/providers/NostrProvider'
import { LogIn, LogOut, Plus, Wallet } from 'lucide-react'
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
    <ResponsiveMenu>
      <ResponsiveMenuTrigger asChild>
        <Button
          variant="ghost"
          className={cn(
            'clickable shadow-none p-2 flex items-center bg-transparent text-foreground hover:text-accent-foreground rounded-lg justify-start gap-4 text-lg font-semibold',
            collapse ? 'w-12 h-12' : 'w-full h-auto'
          )}
        >
          <div className="flex gap-2 items-center flex-1 w-0">
            <SimpleUserAvatar size="medium" userId={pubkey} />
            {!collapse && (
              <SimpleUsername className="truncate font-semibold text-lg" userId={pubkey} />
            )}
          </div>
        </Button>
      </ResponsiveMenuTrigger>
      <ResponsiveMenuContent side="top" className="w-72">
        <ResponsiveMenuItem onClick={() => push(toWallet())}>
          <Wallet />
          {t('Wallet')}
        </ResponsiveMenuItem>
        <ResponsiveMenuSeparator />
        <ResponsiveMenuLabel>{t('Switch account')}</ResponsiveMenuLabel>
        {accounts.map((act) => (
          <ResponsiveMenuItem
            className={act.pubkey === pubkey ? 'cursor-default focus:bg-background' : ''}
            key={`${act.pubkey}:${act.signerType}`}
            onClick={() => {
              if (act.pubkey !== pubkey) {
                switchAccount(act)
              }
            }}
          >
            <div className="flex gap-2 items-center flex-1">
              <SimpleUserAvatar userId={act.pubkey} />
              <div className="flex-1 w-0">
                <SimpleUsername
                  userId={act.pubkey}
                  className="font-medium truncate"
                  skeletonClassName="h-3"
                />
                <SignerTypeBadge signerType={act.signerType} />
              </div>
            </div>
            <div
              className={cn(
                'border border-muted-foreground rounded-full size-3.5',
                act.pubkey === pubkey && 'size-4 border-4 border-primary'
              )}
            />
          </ResponsiveMenuItem>
        ))}
        <div className="border border-dashed m-2 rounded-md">
          <ResponsiveMenuItem onClick={() => setLoginDialogOpen(true)}>
            <div className="flex gap-2 items-center justify-center w-full py-2">
              <Plus />
              {t('Add an Account')}
            </div>
          </ResponsiveMenuItem>
        </div>
        <ResponsiveMenuItem
          className="text-destructive focus:text-destructive"
          onClick={() => setLogoutDialogOpen(true)}
        >
          <LogOut />
          <span className="shrink-0">{t('Logout')}</span>
          <SimpleUsername
            userId={pubkey}
            className="text-muted-foreground border border-muted-foreground px-1 rounded-md text-xs truncate ml-auto"
          />
        </ResponsiveMenuItem>
      </ResponsiveMenuContent>
      <LoginDialog open={loginDialogOpen} setOpen={setLoginDialogOpen} />
      <LogoutDialog open={logoutDialogOpen} setOpen={setLogoutDialogOpen} />
    </ResponsiveMenu>
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
