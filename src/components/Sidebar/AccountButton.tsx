import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { toWallet } from '@/lib/link'
import { formatPubkey, generateImageByPubkey } from '@/lib/pubkey'
import { cn } from '@/lib/utils'
import { usePrimaryPage, useSecondaryPage } from '@/PageManager'
import { useNostr } from '@/providers/NostrProvider'
import { ArrowDownUp, LogIn, LogOut, UserRound, Wallet } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import LoginDialog from '../LoginDialog'
import LogoutDialog from '../LogoutDialog'
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
  const { account, profile } = useNostr()
  const pubkey = account?.pubkey
  const { navigate } = usePrimaryPage()
  const { push } = useSecondaryPage()
  const [loginDialogOpen, setLoginDialogOpen] = useState(false)
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false)
  if (!pubkey) return null

  const defaultAvatar = generateImageByPubkey(pubkey)
  const { username, avatar } = profile || { username: formatPubkey(pubkey), avatar: defaultAvatar }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className={cn(
            'clickable shadow-none p-2 flex items-center bg-transparent text-foreground hover:text-accent-foreground rounded-lg justify-start gap-4 text-lg font-semibold',
            collapse ? 'w-12 h-12' : 'w-full h-auto'
          )}
        >
          <div className="flex gap-2 items-center flex-1 w-0">
            <Avatar className="w-8 h-8">
              <AvatarImage src={avatar} />
              <AvatarFallback>
                <img src={defaultAvatar} />
              </AvatarFallback>
            </Avatar>
            {!collapse && <div className="truncate font-semibold text-lg">{username}</div>}
          </div>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top">
        <DropdownMenuItem onClick={() => navigate('profile')}>
          <UserRound />
          {t('Profile')}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => push(toWallet())}>
          <Wallet />
          {t('Wallet')}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => setLoginDialogOpen(true)}>
          <ArrowDownUp />
          {t('Switch account')}
        </DropdownMenuItem>
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          onClick={() => setLogoutDialogOpen(true)}
        >
          <LogOut />
          {t('Logout')}
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
