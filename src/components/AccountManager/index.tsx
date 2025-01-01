import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { useNostr } from '@/providers/NostrProvider'
import { TSignerType } from '@/types'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import AccountList from '../AccountList'
import BunkerLogin from './BunkerLogin'
import PrivateKeyLogin from './NsecLogin'

export default function AccountManager({ close }: { close?: () => void }) {
  const [loginMethod, setLoginMethod] = useState<TSignerType | null>(null)

  return (
    <>
      {loginMethod === 'nsec' ? (
        <PrivateKeyLogin back={() => setLoginMethod(null)} onLoginSuccess={() => close?.()} />
      ) : loginMethod === 'bunker' ? (
        <BunkerLogin back={() => setLoginMethod(null)} onLoginSuccess={() => close?.()} />
      ) : (
        <AccountManagerNav setLoginMethod={setLoginMethod} close={close} />
      )}
    </>
  )
}

function AccountManagerNav({
  setLoginMethod,
  close
}: {
  setLoginMethod: (method: TSignerType) => void
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
      <Button variant="secondary" onClick={() => setLoginMethod('bunker')} className="w-full">
        {t('Login with Bunker')}
      </Button>
      <Button variant="secondary" onClick={() => setLoginMethod('nsec')} className="w-full">
        {t('Login with Private Key')}
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
