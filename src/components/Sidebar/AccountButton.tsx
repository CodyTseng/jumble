import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { toProfile } from '@/lib/link'
import { formatPubkey, generateImageByPubkey } from '@/lib/pubkey'
import { useSecondaryPage } from '@/PageManager'
import { useNostr } from '@/providers/NostrProvider'
import { LogIn } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import LoginDialog from '../LoginDialog'
import LogoutDialog from '../LogoutDialog'
import SidebarItem from './SidebarItem'

export default function AccountButton() {
  const { pubkey } = useNostr()

  if (pubkey) {
    return <ProfileButton />
  } else {
    return <LoginButton />
  }
}

function ProfileButton() {
  const { t } = useTranslation()
  const { account, profile } = useNostr()
  const pubkey = account?.pubkey
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
          className="clickable shadow-none p-2 xl:px-2 xl:py-2 w-12 h-12 xl:w-full xl:h-auto flex items-center bg-transparent text-foreground hover:text-accent-foreground rounded-lg justify-start gap-4 text-lg font-semibold"
        >
          <div className="flex gap-2 items-center flex-1 w-0">
            <Avatar className="w-8 h-8">
              <AvatarImage src={avatar} />
              <AvatarFallback>
                <img src={defaultAvatar} />
              </AvatarFallback>
            </Avatar>
            <div className="truncate font-semibold text-lg">{username}</div>
          </div>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onClick={() => push(toProfile(pubkey))}>{t('Profile')}</DropdownMenuItem>
        <DropdownMenuItem onClick={() => setLoginDialogOpen(true)}>
          {t('Switch account')}
        </DropdownMenuItem>
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          onClick={() => setLogoutDialogOpen(true)}
        >
          {t('Logout')}
        </DropdownMenuItem>
      </DropdownMenuContent>
      <LoginDialog open={loginDialogOpen} setOpen={setLoginDialogOpen} />
      <LogoutDialog open={logoutDialogOpen} setOpen={setLogoutDialogOpen} />
    </DropdownMenu>
  )
}

function LoginButton() {
  const { checkLogin } = useNostr()

  return (
    <SidebarItem onClick={() => checkLogin()} title="Login">
      <LogIn strokeWidth={3} />
    </SidebarItem>
  )
}
