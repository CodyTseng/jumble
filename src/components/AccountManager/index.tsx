import { Separator } from '@/components/ui/separator'
import { POMEGRANATE_ENABLED } from '@/constants'
import { cn } from '@/lib/utils'
import { isElectron } from '@/lib/platform'
import { isDevEnv } from '@/lib/utils'
import { useNostr } from '@/providers/NostrProvider'
import { ChevronRight, Eye, KeyRound, Puzzle, Server } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import GoogleLogo from '@/assets/GoogleLogo'
import AccountList from '../AccountList'
import GoogleLogin from './GoogleLogin'
import NostrConnectLogin from './NostrConnectionLogin'
import NpubLogin from './NpubLogin'
import PrivateKeyLogin from './PrivateKeyLogin'
import Signup from './Signup'

type TAccountManagerPage = 'nsec' | 'bunker' | 'npub' | 'signup' | 'google' | null

const SHOW_GOOGLE_LOGIN = POMEGRANATE_ENABLED && !isElectron()

export default function AccountManager({ close }: { close?: () => void }) {
  const [page, setPage] = useState<TAccountManagerPage>(null)

  return (
    <>
      {page === 'nsec' ? (
        <PrivateKeyLogin back={() => setPage(null)} onLoginSuccess={() => close?.()} />
      ) : page === 'bunker' ? (
        <NostrConnectLogin back={() => setPage(null)} onLoginSuccess={() => close?.()} />
      ) : page === 'npub' ? (
        <NpubLogin back={() => setPage(null)} onLoginSuccess={() => close?.()} />
      ) : page === 'signup' ? (
        <Signup back={() => setPage(null)} onSignupSuccess={() => close?.()} />
      ) : page === 'google' ? (
        <GoogleLogin back={() => setPage(null)} onLoginSuccess={() => close?.()} />
      ) : (
        <AccountManagerNav setPage={setPage} close={close} />
      )}
    </>
  )
}

function AccountManagerNav({
  setPage,
  close
}: {
  setPage: (page: TAccountManagerPage) => void
  close?: () => void
}) {
  const { t } = useTranslation()
  const { nip07Login, accounts } = useNostr()
  const hasExtension = !!window.nostr

  const otherMethods: {
    key: string
    label: string
    icon: JSX.Element
    onClick: () => void
    show: boolean
  }[] = [
    {
      key: 'bunker',
      label: t('Remote signer'),
      icon: <Server />,
      onClick: () => setPage('bunker'),
      show: true
    },
    {
      key: 'google',
      label: 'Google',
      icon: <GoogleLogo />,
      onClick: () => setPage('google'),
      show: SHOW_GOOGLE_LOGIN
    },
    {
      key: 'nsec',
      label: t('Private Key'),
      icon: <KeyRound />,
      onClick: () => setPage('nsec'),
      show: true
    },
    {
      key: 'npub',
      label: t('Public Key'),
      icon: <Eye />,
      onClick: () => setPage('npub'),
      show: isDevEnv()
    }
  ]

  const visibleOtherMethods = otherMethods.filter((m) => m.show)
  const otherCount = visibleOtherMethods.length

  return (
    <div onClick={(e) => e.stopPropagation()} className="space-y-5">
      {/* Login methods */}
      <div>
        <SectionTitle>{t('Add an Account')}</SectionTitle>

        {hasExtension && (
          <button
            type="button"
            onClick={() => nip07Login().then(() => close?.())}
            className="bg-primary text-primary-foreground hover:bg-primary-hover mt-3 flex w-full items-center gap-3 rounded-xl px-4 py-3 transition-colors"
          >
            <Puzzle className="size-5 shrink-0" />
            <span className="flex-1 text-start text-sm font-semibold">
              {t('Login with Browser Extension')}
            </span>
            <ChevronRight className="size-4 shrink-0 opacity-70 rtl:-scale-x-100" />
          </button>
        )}

        {hasExtension && otherCount > 0 && (
          <div className="my-3 flex items-center gap-3">
            <div className="bg-border h-px flex-1" />
            <span className="text-muted-foreground/70 text-xs tracking-wide uppercase">
              {t('or')}
            </span>
            <div className="bg-border h-px flex-1" />
          </div>
        )}

        <div className={cn('flex justify-around gap-2', !hasExtension && 'mt-3')}>
          {visibleOtherMethods.map((m) => (
            <LoginMethodTile key={m.key} label={m.label} icon={m.icon} onClick={m.onClick} />
          ))}
        </div>
        <div className="text-muted-foreground mt-3 flex items-center justify-center gap-1.5 text-sm">
          <span>{t("Don't have an account yet?")}</span>
          <button
            type="button"
            onClick={() => setPage('signup')}
            className="text-primary inline-flex items-center gap-1 font-semibold hover:underline"
          >
            {t('Create New Account')}
            <ChevronRight className="size-3.5 rtl:-scale-x-100" />
          </button>
        </div>
      </div>

      {accounts.length > 0 && (
        <>
          <Separator />
          <div>
            <SectionTitle>
              {t('Logged in Accounts')}
              <span className="text-muted-foreground/70 ms-1.5 text-xs font-normal">
                {accounts.length}
              </span>
            </SectionTitle>
            <AccountList className="mt-3" afterSwitch={() => close?.()} />
          </div>
        </>
      )}
    </div>
  )
}

function SectionTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'text-muted-foreground/80 text-xs font-semibold tracking-wide uppercase',
        className
      )}
    >
      {children}
    </div>
  )
}

function LoginMethodTile({
  label,
  icon,
  onClick
}: {
  label: string
  icon: JSX.Element
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group border-border bg-card hover:border-primary/60 hover:bg-accent/40 [&_svg]:text-muted-foreground group-hover:[&_svg]:text-foreground flex w-full flex-col items-center justify-center gap-2 rounded-xl border px-2 py-4 transition-colors [&_svg]:size-5 [&_svg]:transition-colors"
    >
      {icon}
      <span className="text-xs leading-tight font-medium">{label}</span>
    </button>
  )
}
