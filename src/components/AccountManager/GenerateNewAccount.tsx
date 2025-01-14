import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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

  const handleLogin = () => {
    nsecLogin(nsec).then(() => onLoginSuccess())
  }

  return (
    <>
      <div className="text-orange-400">
        {t(
          'This is a private key. Do not share it with anyone. Keep it safe and secure. You will not be able to recover it if you lose it.'
        )}
      </div>
      <div className="flex gap-2">
        <Input value={nsec} />
        <Button variant="secondary" onClick={() => setNsec(generateNsec())}>
          <RefreshCcw />
        </Button>
        <Button
          onClick={() => {
            navigator.clipboard.writeText(nsec)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
          }}
        >
          {copied ? <Check /> : <Copy />}
        </Button>
      </div>
      <Button onClick={handleLogin}>{t('Login')}</Button>
      <Button variant="secondary" onClick={back}>
        {t('Back')}
      </Button>
    </>
  )
}

function generateNsec() {
  const sk = generateSecretKey()
  return nsecEncode(sk)
}
