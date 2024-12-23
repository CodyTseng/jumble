import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { useFetchProfile } from '@/hooks'
import { toProfile } from '@/lib/link'
import { formatPubkey, generateImageByPubkey } from '@/lib/pubkey'
import { useSecondaryPage } from '@/PageManager'
import { useNostr } from '@/providers/NostrProvider'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import LoginDialog from '../LoginDialog'

export default function ProfileButton({
  variant = 'titlebar'
}: {
  variant?: 'titlebar' | 'sidebar' | 'small-screen-titlebar'
}) {
  const { t } = useTranslation()
  const { removeAccount, account } = useNostr()
  const pubkey = account?.pubkey
  const { profile } = useFetchProfile(pubkey)
  const { push } = useSecondaryPage()
  const [loginDialogOpen, setLoginDialogOpen] = useState(false)
  if (!pubkey) return null

  const defaultAvatar = generateImageByPubkey(pubkey)
  const { username, avatar } = profile || { username: formatPubkey(pubkey), avatar: defaultAvatar }

  let triggerComponent: React.ReactNode
  if (variant === 'titlebar') {
    triggerComponent = (
      <button>
        <Avatar className="ml-2 w-6 h-6 hover:opacity-90">
          <AvatarImage src={avatar} />
          <AvatarFallback>
            <img src={defaultAvatar} />
          </AvatarFallback>
        </Avatar>
      </button>
    )
  } else if (variant === 'small-screen-titlebar') {
    triggerComponent = (
      <button>
        <Avatar className="w-8 h-8 hover:opacity-90">
          <AvatarImage src={avatar} />
          <AvatarFallback>
            <img src={defaultAvatar} />
          </AvatarFallback>
        </Avatar>
      </button>
    )
  } else {
    triggerComponent = (
      <Button variant="sidebar" size="sidebar" className="border hover:bg-muted px-2">
        <div className="flex gap-2 items-center flex-1 w-0">
          <Avatar className="w-10 h-10">
            <AvatarImage src={avatar} />
            <AvatarFallback>
              <img src={defaultAvatar} />
            </AvatarFallback>
          </Avatar>
          <div className="truncate font-semibold text-lg">{username}</div>
        </div>
      </Button>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{triggerComponent}</DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onClick={() => push(toProfile(pubkey))}>{t('Profile')}</DropdownMenuItem>
        <DropdownMenuItem onClick={() => setLoginDialogOpen(true)}>
          {t('Manage accounts')}
        </DropdownMenuItem>
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          onClick={() => removeAccount(account)}
        >
          {t('Logout')}
        </DropdownMenuItem>
      </DropdownMenuContent>
      <LoginDialog open={loginDialogOpen} setOpen={setLoginDialogOpen} />
    </DropdownMenu>
  )
}
