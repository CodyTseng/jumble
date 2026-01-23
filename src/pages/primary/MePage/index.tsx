import AccountManager from '@/components/AccountManager'
import LoginDialog from '@/components/LoginDialog'
import LogoutDialog from '@/components/LogoutDialog'
import NpubQrCode from '@/components/NpubQrCode'
import PubkeyCopy from '@/components/PubkeyCopy'
import { SparkWalletBalance } from '@/components/SparkWalletBalance'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { SimpleUserAvatar } from '@/components/UserAvatar'
import { SimpleUsername } from '@/components/Username'
import PrimaryPageLayout from '@/layouts/PrimaryPageLayout'
import { toBookmarks, toProfile, toRelaySettings, toSettings, toWallet } from '@/lib/link'
import { cn } from '@/lib/utils'
import { useSecondaryPage } from '@/PageManager'
import { useNostr } from '@/providers/NostrProvider'
import { TPageRef } from '@/types'
import {
  ArrowDownUp,
  Bookmark,
  ChevronRight,
  LogOut,
  Server,
  Settings,
  UserRound,
  Wallet
} from 'lucide-react'
import { forwardRef, HTMLProps, useState } from 'react'
import { useTranslation } from 'react-i18next'

const MePage = forwardRef<TPageRef>((_, ref) => {
  const { t } = useTranslation()
  const { push } = useSecondaryPage()
  const { pubkey } = useNostr()
  const [loginDialogOpen, setLoginDialogOpen] = useState(false)
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false)

  if (!pubkey) {
    return (
      <PrimaryPageLayout
        ref={ref}
        pageName="home"
        titlebar={<MePageTitlebar />}
        hideTitlebarBottomBorder
      >
        <div className="flex flex-col gap-4 overflow-auto p-4">
          <AccountManager />
        </div>
      </PrimaryPageLayout>
    )
  }

  return (
    <PrimaryPageLayout
      ref={ref}
      pageName="home"
      titlebar={<MePageTitlebar />}
      hideTitlebarBottomBorder
    >
      <div className="flex items-center gap-4 p-4">
        <SimpleUserAvatar userId={pubkey} size="big" />
        <div className="w-0 flex-1 space-y-1">
          <SimpleUsername
            className="text-wrap text-xl font-semibold"
            userId={pubkey}
            skeletonClassName="h-6 w-32"
          />
          <div className="mt-1 flex gap-1">
            <PubkeyCopy pubkey={pubkey} />
            <NpubQrCode pubkey={pubkey} />
          </div>
        </div>
      </div>
      <div className="mt-4">
        <Item onClick={() => push(toProfile(pubkey))}>
          <UserRound />
          {t('Profile')}
        </Item>
        <Item onClick={() => push(toRelaySettings())}>
          <Server /> {t('Relays')}
        </Item>
        <Item onClick={() => push(toBookmarks())}>
          <Bookmark /> {t('Bookmarks')}
        </Item>
        <Item onClick={() => push(toWallet())}>
          <Wallet />
          {t('Wallet')}
        </Item>
        <Item onClick={() => setLoginDialogOpen(true)}>
          <ArrowDownUp /> {t('Switch account')}
        </Item>
        <Separator className="bg-background" />
        <Item
          className="text-destructive focus:text-destructive"
          onClick={() => setLogoutDialogOpen(true)}
          hideChevron
        >
          <LogOut />
          {t('Logout')}
        </Item>
      </div>
      <LoginDialog open={loginDialogOpen} setOpen={setLoginDialogOpen} />
      <LogoutDialog open={logoutDialogOpen} setOpen={setLogoutDialogOpen} />
    </PrimaryPageLayout>
  )
})
MePage.displayName = 'MePage'
export default MePage

function MePageTitlebar() {
  const { push } = useSecondaryPage()
  return (
    <div className="flex justify-end items-center gap-1">
      <SparkWalletBalance />
      <Button variant="ghost" size="titlebar-icon" onClick={() => push(toSettings())}>
        <Settings />
      </Button>
    </div>
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
        'clickable flex h-[52px] items-center justify-between rounded-lg px-4 py-2 [&_svg]:size-4 [&_svg]:shrink-0',
        className
      )}
      {...props}
    >
      <div className="flex items-center gap-4">{children}</div>
      {!hideChevron && <ChevronRight />}
    </div>
  )
}
