import AccountManager from '@/components/AccountManager'
import LoginDialog from '@/components/LoginDialog'
import LogoutDialog from '@/components/LogoutDialog'
import PubkeyCopy from '@/components/PubkeyCopy'
import QrCodePopover from '@/components/QrCodePopover'
import { SimpleUserAvatar } from '@/components/UserAvatar'
import { SimpleUsername } from '@/components/Username'
import PrimaryPageLayout from '@/layouts/PrimaryPageLayout'
import { toProfile, toSettings } from '@/lib/link'
import { cn } from '@/lib/utils'
import { useSecondaryPage } from '@/PageManager'
import { useNostr } from '@/providers/NostrProvider'
import { ArrowDownUp, ChevronRight, LogOut, Settings, UserRound } from 'lucide-react'
import { HTMLProps, useState } from 'react'
import { useTranslation } from 'react-i18next'

export default function MePage() {
  const { t } = useTranslation()
  const { push } = useSecondaryPage()
  const { pubkey } = useNostr()
  const [loginDialogOpen, setLoginDialogOpen] = useState(false)
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false)

  if (!pubkey) {
    return (
      <PrimaryPageLayout pageName="home">
        <div className="flex flex-col p-4 gap-4 overflow-auto">
          <AccountManager />
        </div>
      </PrimaryPageLayout>
    )
  }

  return (
    <PrimaryPageLayout pageName="home">
      <div className="flex gap-4 items-center p-4">
        <SimpleUserAvatar userId={pubkey} size="big" />
        <div className="space-y-1">
          <SimpleUsername
            className="text-xl font-semibold truncate"
            userId={pubkey}
            skeletonClassName="h-6 w-32"
          />
          <div className="flex gap-1 mt-1">
            <PubkeyCopy pubkey={pubkey} />
            <QrCodePopover pubkey={pubkey} />
          </div>
        </div>
      </div>
      <div className="mt-4">
        <ItemGroup>
          <Item onClick={() => push(toProfile(pubkey))}>
            <UserRound />
            {t('Profile')}
          </Item>
        </ItemGroup>
        <ItemGroup>
          <Item onClick={() => push(toSettings())}>
            <Settings />
            {t('Settings')}
          </Item>
        </ItemGroup>
        <ItemGroup>
          <Item onClick={() => setLoginDialogOpen(true)}>
            <ArrowDownUp /> {t('Accounts')}
          </Item>
          <Item
            className="text-destructive focus:text-destructive"
            onClick={() => setLogoutDialogOpen(true)}
            hideChevron
          >
            <LogOut />
            {t('Logout')}
          </Item>
        </ItemGroup>
      </div>
      <LoginDialog open={loginDialogOpen} setOpen={setLoginDialogOpen} />
      <LogoutDialog open={logoutDialogOpen} setOpen={setLogoutDialogOpen} />
    </PrimaryPageLayout>
  )
}

function Item({
  children,
  className,
  hideChevron = false,
  ...props
}: HTMLProps<HTMLDivElement> & { hideChevron?: boolean }) {
  return (
    <div
      className={cn(
        'flex items-center justify-between p-4 w-full clickable rounded-lg [&_svg]:size-4 [&_svg]:shrink-0',
        className
      )}
      {...props}
    >
      <div className="flex items-center gap-4">{children}</div>
      {!hideChevron && <ChevronRight />}
    </div>
  )
}

function ItemGroup({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg m-4 bg-muted/30">{children}</div>
}
