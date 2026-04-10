import AccountManager from '@/components/AccountManager'
import LoginDialog from '@/components/LoginDialog'
import LogoutDialog from '@/components/LogoutDialog'
import Nip05 from '@/components/Nip05'
import PubkeyCopy from '@/components/PubkeyCopy'
import QrCodeDisplay from '@/components/QrCode'
import { Drawer, DrawerContent, DrawerTrigger } from '@/components/ui/drawer'
import { Separator } from '@/components/ui/separator'
import UserAvatar, { SimpleUserAvatar } from '@/components/UserAvatar'
import Username, { SimpleUsername } from '@/components/Username'
import { formatNpub } from '@/lib/pubkey'
import { toBookmarks, toProfile, toRelaySettings, toSettings, toWallet } from '@/lib/link'
import { cn } from '@/lib/utils'
import { useSecondaryPage } from '@/PageManager'
import { useNostr } from '@/providers/NostrProvider'
import {
  ArrowDownUp,
  Bookmark,
  Check,
  Copy,
  LogOut,
  QrCode,
  Server,
  Settings,
  UserRound,
  Wallet
} from 'lucide-react'
import { nip19 } from 'nostr-tools'
import { HTMLProps, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

export default function MeDrawerContent({ onClose }: { onClose?: () => void }) {
  const { t } = useTranslation()
  const { push } = useSecondaryPage()
  const { pubkey } = useNostr()
  const [loginDialogOpen, setLoginDialogOpen] = useState(false)
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const npub = useMemo(() => (pubkey ? nip19.npubEncode(pubkey) : ''), [pubkey])

  const navigate = (path: string) => {
    onClose?.()
    push(path)
  }

  const copyNpub = () => {
    if (!npub) return
    navigator.clipboard.writeText(npub)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (!pubkey) {
    return (
      <div className="flex flex-col gap-4 overflow-auto p-4">
        <AccountManager />
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="px-5 pb-4 pt-4">
        <div className="flex justify-end">
          <Drawer>
            <DrawerTrigger asChild>
              <button className="clickable flex size-10 items-center justify-center rounded-full border border-border text-muted-foreground hover:text-foreground">
                <QrCode className="size-5" />
              </button>
            </DrawerTrigger>
            <DrawerContent>
              <div className="flex w-full flex-col items-center gap-4 p-8">
                <div className="pointer-events-none flex w-full items-center gap-2 px-1">
                  <UserAvatar size="big" userId={pubkey} />
                  <div className="w-0 flex-1">
                    <Username userId={pubkey} className="truncate text-2xl font-semibold" />
                    <Nip05 pubkey={pubkey} />
                  </div>
                </div>
                <QrCodeDisplay size={512} value={`nostr:${npub}`} />
                <PubkeyCopy pubkey={pubkey} />
              </div>
            </DrawerContent>
          </Drawer>
        </div>
        <div className="flex items-center gap-3">
          <SimpleUserAvatar userId={pubkey} size="big" className="shrink-0" />
          <div className="min-w-0">
            <SimpleUsername
              className="truncate text-xl font-semibold"
              userId={pubkey}
              skeletonClassName="h-6 w-28"
            />
            <button
              className="clickable mt-1 flex max-w-full items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground active:bg-muted/70"
              onClick={copyNpub}
            >
              <span className="truncate">{formatNpub(npub, 20)}</span>
              {copied ? <Check className="size-3 shrink-0" /> : <Copy className="size-3 shrink-0" />}
            </button>
          </div>
        </div>
      </div>

      <Separator />

      {/* Menu */}
      <div className="flex-1 px-2 py-1">
        <Item onClick={() => navigate(toProfile(pubkey))}>
          <UserRound />
          {t('Profile')}
        </Item>
        <Item onClick={() => navigate(toRelaySettings())}>
          <Server />
          {t('Relays')}
        </Item>
        <Item onClick={() => navigate(toBookmarks())}>
          <Bookmark />
          {t('Bookmarks')}
        </Item>
        <Item onClick={() => navigate(toWallet())}>
          <Wallet />
          {t('Wallet')}
        </Item>
        <Item onClick={() => navigate(toSettings())}>
          <Settings />
          {t('Settings')}
        </Item>
      </div>

      {/* Footer */}
      <Separator />
      <div className="px-2 py-1" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <Item onClick={() => setLoginDialogOpen(true)}>
          <ArrowDownUp />
          {t('Switch account')}
        </Item>
        <Item
          className="text-destructive focus:text-destructive"
          onClick={() => setLogoutDialogOpen(true)}
        >
          <LogOut />
          {t('Logout')}
        </Item>
      </div>

      <LoginDialog open={loginDialogOpen} setOpen={setLoginDialogOpen} />
      <LogoutDialog open={logoutDialogOpen} setOpen={setLogoutDialogOpen} />
    </div>
  )
}

function Item({
  children,
  className,
  ...props
}: HTMLProps<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'clickable flex h-12 items-center rounded-lg px-3 py-2 [&_svg]:size-5 [&_svg]:shrink-0',
        className
      )}
      {...props}
    >
      <div className="flex items-center gap-3 text-base font-medium">{children}</div>
    </div>
  )
}
