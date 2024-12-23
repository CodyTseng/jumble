import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useNostr } from '@/providers/NostrProvider'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

export default function PrivateKeyLogin({
  back,
  onLoginSuccess
}: {
  back: () => void
  onLoginSuccess: () => void
}) {
  const { t } = useTranslation()
  const { nsecLogin } = useNostr()
  const [nsec, setNsec] = useState('')
  const [errMsg, setErrMsg] = useState<string | null>(null)

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNsec(e.target.value)
    setErrMsg(null)
  }

  const handleLogin = () => {
    if (nsec === '') return

    nsecLogin(nsec)
      .then(() => onLoginSuccess())
      .catch((err) => {
        setErrMsg(err.message)
      })
  }

  return (
    <>
      <div className="text-orange-400">
        {t(
          'Using private key login is insecure. It is recommended to use a browser extension for login, such as alby, nostr-keyx or nos2x.'
        )}
      </div>
      <div className="space-y-1">
        <Input
          type="password"
          placeholder="nsec1.."
          value={nsec}
          onChange={handleInputChange}
          className={errMsg ? 'border-destructive' : ''}
        />
        {errMsg && <div className="text-xs text-destructive pl-3">{errMsg}</div>}
      </div>
      <Button onClick={handleLogin}>{t('Login')}</Button>
      <Button variant="secondary" onClick={back}>
        {t('Back')}
      </Button>
    </>
  )
}
