import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { useNostr } from '@/providers/NostrProvider'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import AccountList from '../AccountList'
import BunkerLogin from './BunkerLogin'
import GenerateNewAccount from './GenerateNewAccount'
import { PopupProvider, usePopup } from './PopupProvider'
import PrivateKeyLogin from './PrivateKeyLogin'
import SignupWithNstart from './SignupWithNstart'

type TAccountManagerPage = 'nsec' | 'bunker' | 'generate' | 'nstart' | null

export default function AccountManager({ close }: { close?: () => void }) {
  const [page, setPage] = useState<TAccountManagerPage>(null)

  return (
    <PopupProvider>
      {page === 'nsec' ? (
        <PrivateKeyLogin back={() => setPage(null)} onLoginSuccess={() => close?.()} />
      ) : page === 'bunker' ? (
        <BunkerLogin back={() => setPage(null)} onLoginSuccess={() => close?.()} />
      ) : page === 'generate' ? (
        <GenerateNewAccount back={() => setPage(null)} onLoginSuccess={() => close?.()} />
      ) : page === 'nstart' ? (
        <SignupWithNstart back={() => setPage(null)} onLoginSuccess={() => close?.()} />
      ) : (
        <AccountManagerNav setPage={setPage} close={close} />
      )}
    </PopupProvider>
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
  const { setPopupWindow } = usePopup()
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
          onClick={() => {
            const popupWindow = window.open(
              `https://start.njump.me?an=Jumble&at=popup&ac=${window.location.href}`,
              'popup',
              'width=600,height=800'
            )
            setPopupWindow(popupWindow)
            setPage('nstart')
          }}
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
