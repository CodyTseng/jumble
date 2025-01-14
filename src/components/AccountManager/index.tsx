import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { useNostr } from '@/providers/NostrProvider'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import AccountList from '../AccountList'
import BunkerLogin from './BunkerLogin'
import PrivateKeyLogin from './NsecLogin'
import GenerateNewAccount from './GenerateNewAccount'

type TAccountManagerPage = 'nsec' | 'bunker' | 'generate' | null

export default function AccountManager({ close }: { close?: () => void }) {
  const [page, setPage] = useState<TAccountManagerPage>(null)

  return (
    <>
      {page === 'nsec' ? (
        <PrivateKeyLogin back={() => setPage(null)} onLoginSuccess={() => close?.()} />
      ) : page === 'bunker' ? (
        <BunkerLogin back={() => setPage(null)} onLoginSuccess={() => close?.()} />
      ) : page === 'generate' ? (
        <GenerateNewAccount back={() => setPage(null)} onLoginSuccess={() => close?.()} />
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
    <div onClick={(e) => e.stopPropagation()} className="flex flex-col gap-4">
      <div className="text-center text-muted-foreground text-sm font-semibold">
        {t('Add an Account')}
      </div>
      {!!window.nostr && (
        <Button onClick={() => nip07Login().then(() => close?.())} className="w-full">
          {t('Login with Browser Extension')}
        </Button>
      )}
      <Button variant="secondary" onClick={() => setPage('bunker')} className="w-full">
        {t('Login with Bunker')}
      </Button>
      <Button variant="secondary" onClick={() => setPage('nsec')} className="w-full">
        {t('Login with Private Key')}
      </Button>
      <Separator />
      <div className="text-center text-muted-foreground text-sm font-semibold">
        {t("Don't have an account yet?")}
      </div>
      <Button variant="secondary" onClick={() => setPage('generate')} className="w-full">
        {t('Generate New Account')}
      </Button>
      {accounts.length > 0 && (
        <>
          <Separator />
          <div className="text-center text-muted-foreground text-sm font-semibold">
            {t('Logged in Accounts')}
          </div>
          <AccountList afterSwitch={() => close?.()} />
        </>
      )}
    </div>
  )
}
