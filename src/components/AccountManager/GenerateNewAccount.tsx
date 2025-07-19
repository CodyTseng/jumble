import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useNostr } from '@/providers/NostrProvider'
import { Check, Copy, RefreshCcw } from 'lucide-react'
import { generateSecretKey } from 'nostr-tools'
import { nsecEncode } from 'nostr-tools/nip19'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

export default function GenerateNewAccount({
  back,
  onLoginSuccess
}: {
  back: () => void
  onLoginSuccess: () => void
}) {
  const { t } = useTranslation()
  const { nsecLogin } = useNostr()
  const [nsec, setNsec] = useState(generateNsec())
  const [copied, setCopied] = useState(false)
  const [password, setPassword] = useState('')

  const handleLogin = () => {
    nsecLogin(nsec, password).then(() => onLoginSuccess())
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        handleLogin()
      }}
    >
      <div className="text-orange-400">
        {t(
          'This is a private key. Do not share it with anyone. Keep it safe and secure. You will not be able to recover it if you lose it.'
        )}
      </div>
      <div className="grid gap-2">
        <Label>nsec</Label>
        <div className="flex gap-2">
          <Input value={nsec} />
          <Button type="button" variant="secondary" onClick={() => setNsec(generateNsec())}>
            <RefreshCcw />
          </Button>
          <Button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(nsec)
              setCopied(true)
              setTimeout(() => setCopied(false), 2000)
            }}
          >
            {copied ? <Check /> : <Copy />}
          </Button>
        </div>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="password-input">{t('password')}</Label>
        <Input
          id="password-input"
          type="password"
          placeholder={t('optional: encrypt nsec')}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <div className="flex gap-2">
        <Button className="w-fit px-8" variant="secondary" type="button" onClick={back}>
          {t('Back')}
        </Button>
        <Button className="flex-1" type="submit">
          {t('Login')}
        </Button>
      </div>
    </form>
  )
}

function generateNsec() {
  const sk = generateSecretKey()
  return nsecEncode(sk)
}
