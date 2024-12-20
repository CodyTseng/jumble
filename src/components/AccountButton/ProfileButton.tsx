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
import { useTranslation } from 'react-i18next'

export default function ProfileButton({
  pubkey,
  variant = 'titlebar'
}: {
  pubkey: string
  variant?: 'titlebar' | 'sidebar' | 'small-screen-titlebar'
}) {
  const { t } = useTranslation()
  const { logout } = useNostr()
  const { profile } = useFetchProfile(pubkey)
  const { push } = useSecondaryPage()

  const defaultAvatar = generateImageByPubkey(pubkey)
  const { username, avatar } = profile || { username: formatPubkey(pubkey), avatar: defaultAvatar }

  let triggerComponent: React.ReactNode
  if (variant === 'titlebar') {
    triggerComponent = (
      <button>
        <Avatar className="w-7 h-7 hover:opacity-90">
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
        <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={logout}>
          {t('Logout')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
