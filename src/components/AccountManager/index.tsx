import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { useNostr } from '@/providers/NostrProvider'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import AccountList from '../AccountList'
import BunkerLogin from './BunkerLogin'
import PrivateKeyLogin from './PrivateKeyLogin'
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
    <div onClick={(e) => e.stopPropagation()} className="flex flex-col gap-8">
      <div>
        <div className="text-center text-muted-foreground text-sm font-semibold">
          {t('Add an Account')}
        </div>
        <div className="space-y-2 mt-4">
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
        </div>
      </div>
      <Separator />
      <div>
        <div className="text-center text-muted-foreground text-sm font-semibold">
          {t("Don't have an account yet?")}
        </div>
        <Button
          onClick={() =>
            window.open(
              `https://start.njump.me?an=Jumble&at=web&ac=${import.meta.env.VITE_DOMAIN_NAME}`,
              '_blank'
            )
          }
          className="w-full mt-4"
        >
          {t('Signup with Nstart wizard')}
        </Button>
        <Button
          variant="link"
          onClick={() => setPage('generate')}
          className="w-full text-muted-foreground py-0 h-fit mt-1"
        >
          {t('or generate your private key here')}
        </Button>
      </div>
      {accounts.length > 0 && (
        <>
          <Separator />
          <div>
            <div className="text-center text-muted-foreground text-sm font-semibold">
              {t('Logged in Accounts')}
            </div>
            <AccountList className="mt-4" afterSwitch={() => close?.()} />
          </div>
        </>
      )}
    </div>
  )
}
