import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { POMEGRANATE_ENABLED } from '@/constants'
import { isElectron } from '@/lib/platform'
import { isDevEnv } from '@/lib/utils'
import { useNostr } from '@/providers/NostrProvider'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
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

  return (
    <div onClick={(e) => e.stopPropagation()} className="flex flex-col gap-8">
      <div>
        <div className="text-center text-sm font-semibold text-muted-foreground">
          {t('Add an Account')}
        </div>
        <div className="mt-4 space-y-2">
          {!!window.nostr && (
            <Button onClick={() => nip07Login().then(() => close?.())} className="w-full">
              {t('Login with Browser Extension')}
            </Button>
          )}
          {SHOW_GOOGLE_LOGIN && (
            <Button variant="secondary" onClick={() => setPage('google')} className="w-full">
              {t('Login with Google')}
            </Button>
          )}
          <Button variant="secondary" onClick={() => setPage('bunker')} className="w-full">
            {t('Login with Bunker')}
          </Button>
          <Button variant="secondary" onClick={() => setPage('nsec')} className="w-full">
            {t('Login with Private Key')}
          </Button>
          {isDevEnv() && (
            <Button variant="secondary" onClick={() => setPage('npub')} className="w-full">
              Login with Public key (for development)
            </Button>
          )}
        </div>
      </div>
      <Separator />
      <div>
        <div className="text-center text-sm font-semibold text-muted-foreground">
          {t("Don't have an account yet?")}
        </div>
        <Button onClick={() => setPage('signup')} className="mt-4 w-full">
          {t('Create New Account')}
        </Button>
      </div>
      {accounts.length > 0 && (
        <>
          <Separator />
          <div>
            <div className="text-center text-sm font-semibold text-muted-foreground">
              {t('Logged in Accounts')}
            </div>
            <AccountList className="mt-4" afterSwitch={() => close?.()} />
          </div>
        </>
      )}
    </div>
  )
}
