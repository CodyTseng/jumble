import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { isSameAccount } from '@/lib/account'
import { cn } from '@/lib/utils'
import { useNostr } from '@/providers/NostrProvider'
import { TSimpleAccount } from '@/types'
import { ArrowLeft, Loader } from 'lucide-react'
import { Dispatch, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { SimpleUserAvatar } from '../UserAvatar'
import BunkerLogin from './BunkerLogin'
import PrivateKeyLogin from './NsecLogin'

export default function LoginDialog({
  open,
  setOpen
}: {
  open: boolean
  setOpen: Dispatch<boolean>
}) {
  const { t } = useTranslation()
  const [loginMethod, setLoginMethod] = useState<'nsec' | 'nip07' | 'bunker' | null>(null)
  const { nip07Login, switchAccount, accounts, account } = useNostr()
  const [switchingAccount, setSwitchingAccount] = useState<TSimpleAccount | null>(null)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="w-96">
        <DialogHeader>
          <DialogTitle className="hidden" />
          <DialogDescription className="hidden" />
        </DialogHeader>
        {loginMethod === 'nsec' ? (
          <>
            <div
              className="absolute left-4 top-4 opacity-70 hover:opacity-100 cursor-pointer"
              onClick={() => setLoginMethod(null)}
            >
              <ArrowLeft className="h-4 w-4" />
            </div>
            <PrivateKeyLogin onLoginSuccess={() => setOpen(false)} />
          </>
        ) : loginMethod === 'bunker' ? (
          <>
            <div
              className="absolute left-4 top-4 opacity-70 hover:opacity-100 cursor-pointer"
              onClick={() => setLoginMethod(null)}
            >
              <ArrowLeft className="h-4 w-4" />
            </div>
            <BunkerLogin onLoginSuccess={() => setOpen(false)} />
          </>
        ) : (
          <>
            {accounts.length > 0 && (
              <div className="flex gap-2 items-center">
                {accounts.map((act) => (
                  <div
                    className={cn(
                      'rounded-full p-0.5 relative',
                      isSameAccount(act, account)
                        ? 'ring-2 ring-primary'
                        : 'cursor-pointer hover:opacity-80'
                    )}
                  >
                    <SimpleUserAvatar
                      key={`${act.pubkey}-${act.signerType}`}
                      userId={act.pubkey}
                      onClick={(e) => {
                        e.stopPropagation()
                        setSwitchingAccount(act)
                        switchAccount(act).finally(() => {
                          setSwitchingAccount(null)
                          setOpen(false)
                        })
                      }}
                    />
                    {isSameAccount(act, switchingAccount) && (
                      <div className="p-2 bg-muted/80 absolute inset-0 rounded-full">
                        <Loader className="w-full h-full animate-spin" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            {!!window.nostr && (
              <Button onClick={() => nip07Login().then(() => setOpen(false))} className="w-full">
                {t('Login with Browser Extension')}
              </Button>
            )}
            <Button variant="secondary" onClick={() => setLoginMethod('bunker')} className="w-full">
              {t('Login with Bunker')}
            </Button>
            <Button variant="secondary" onClick={() => setLoginMethod('nsec')} className="w-full">
              {t('Login with Private Key')}
            </Button>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
