import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useNostr } from '@/providers/NostrProvider'
import { Check, Copy, Download, RefreshCcw } from 'lucide-react'
import { generateSecretKey } from 'nostr-tools'
import { nsecEncode } from 'nostr-tools/nip19'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import InfoCard from '../InfoCard'

type Step = 'generate' | 'password'

export default function Signup({
  back,
  onSignupSuccess
}: {
  back: () => void
  onSignupSuccess: () => void
}) {
  const { t } = useTranslation()
  const { nsecLogin } = useNostr()
  const [step, setStep] = useState<Step>('generate')
  const [nsec, setNsec] = useState(generateNsec())
  const [checkedSaveKey, setCheckedSaveKey] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [copied, setCopied] = useState(false)

  const handleDownload = () => {
    const blob = new Blob([nsec], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'nostr-private-key.txt'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleSignup = async () => {
    await nsecLogin(nsec, password || undefined, true)
    onSignupSuccess()
  }

  const passwordsMatch = password === confirmPassword
  const canSubmit = !password || passwordsMatch

  const renderStepIndicator = () => (
    <div className="flex items-center justify-center gap-2">
      {(['generate', 'password'] as Step[]).map((s, index) => (
        <div key={s} className="flex items-center">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
              step === s
                ? 'bg-primary text-primary-foreground'
                : step === 'password' && s === 'generate'
                  ? 'bg-primary/20 text-primary'
                  : 'bg-muted text-muted-foreground'
            }`}
          >
            {index + 1}
          </div>
          {index < 1 && <div className="w-12 h-0.5 bg-muted mx-1" />}
        </div>
      ))}
    </div>
  )

  if (step === 'generate') {
    return (
      <div className="space-y-6">
        {renderStepIndicator()}

        <div className="text-center">
          <h3 className="text-lg font-semibold mb-2">{t('Create Your Nostr Account')}</h3>
          <p className="text-sm text-muted-foreground">
            {t('Generate your unique private key. This is your digital identity.')}
          </p>
        </div>

        <InfoCard
          variant="alert"
          title={t('Critical: Save Your Private Key')}
          content={t(
            'Your private key IS your account. There is no password recovery. If you lose it, you lose your account forever. Please save it in a secure location.'
          )}
        />

        <div className="space-y-1">
          <Label>{t('Your Private Key')}</Label>
          <div className="flex gap-2">
            <Input
              value={nsec}
              readOnly
              className="font-mono text-sm"
              onClick={(e) => e.currentTarget.select()}
            />
            <Button
              type="button"
              variant="secondary"
              size="icon"
              onClick={() => setNsec(generateNsec())}
              title={t('Generate new key')}
            >
              <RefreshCcw />
            </Button>
          </div>
        </div>

        <div className="w-full flex gap-2 items-center">
          <Button onClick={handleDownload} className="w-full">
            <Download />
            {t('Download Backup File')}
          </Button>
          <Button
            onClick={() => {
              navigator.clipboard.writeText(nsec)
              setCopied(true)
              setTimeout(() => setCopied(false), 2000)
            }}
            variant="secondary"
            className="w-full"
          >
            {copied ? <Check /> : <Copy />}
            {copied ? t('Copied to Clipboard') : t('Copy to Clipboard')}
          </Button>
        </div>

        <div className="flex items-center gap-2 ml-2">
          <Checkbox
            id="acknowledge-checkbox"
            checked={checkedSaveKey}
            onCheckedChange={(c) => setCheckedSaveKey(!!c)}
          />
          <Label htmlFor="acknowledge-checkbox" className="cursor-pointer">
            {t('I have safely backed up my private key')}
          </Label>
        </div>

        <div className="flex gap-2">
          <Button variant="secondary" onClick={back} className="w-fit px-6">
            {t('Back')}
          </Button>

          <Button onClick={() => setStep('password')} className="flex-1" disabled={!checkedSaveKey}>
            {t('Continue')}
          </Button>
        </div>
      </div>
    )
  }

  // step === 'password'
  return (
    <div className="space-y-6">
      {renderStepIndicator()}

      <div className="text-center">
        <h3 className="text-lg font-semibold mb-2">{t('Secure Your Account')}</h3>
        <p className="text-sm text-muted-foreground">
          {t('Add an extra layer of protection with a password')}
        </p>
      </div>

      <InfoCard
        title={t('Password Protection (Recommended)')}
        content={t(
          'Add a password to encrypt your private key in this browser. This is optional but strongly recommended for better security.'
        )}
      />

      <div className="space-y-2">
        <div className="space-y-1">
          <Label htmlFor="password-input">{t('Password (Optional)')}</Label>
          <Input
            id="password-input"
            type="password"
            placeholder={t('Create a password (or skip)')}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        {password && (
          <div className="space-y-1">
            <Label htmlFor="confirm-password-input">{t('Confirm Password')}</Label>
            <Input
              id="confirm-password-input"
              type="password"
              placeholder={t('Enter your password again')}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
            {confirmPassword && !passwordsMatch && (
              <p className="text-xs text-red-500">{t('Passwords do not match')}</p>
            )}
          </div>
        )}
      </div>

      <div className="w-full flex gap-2">
        <Button
          variant="secondary"
          onClick={() => {
            setStep('generate')
            setPassword('')
            setConfirmPassword('')
          }}
          className="w-fit px-6"
        >
          {t('Back')}
        </Button>
        <Button onClick={handleSignup} className="flex-1" disabled={!canSubmit}>
          {t('Complete Signup')}
        </Button>
      </div>
    </div>
  )
}

function generateNsec() {
  const sk = generateSecretKey()
  return nsecEncode(sk)
}
