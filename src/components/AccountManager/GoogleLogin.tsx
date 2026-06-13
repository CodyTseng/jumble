import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { POMEGRANATE_CENTRAL_URL } from '@/constants'
import { downloadTextFile } from '@/lib/download'
import {
  DEFAULT_POMEGRANATE_OPERATORS,
  defaultPomegranateThreshold,
  describePomegranateError
} from '@/lib/pomegranate'
import { useNostr } from '@/providers/NostrProvider'
import pomegranateService, {
  TGoogleToken,
  TPomegranateAccountConfig
} from '@/services/pomegranate.service'
import { Check, Copy, Download, Loader, RefreshCcw } from 'lucide-react'
import { generateSecretKey } from 'nostr-tools'
import { nsecEncode } from 'nostr-tools/nip19'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import AdvancedOptions from '../AdvancedOptions'
import InfoCard from '../InfoCard'
import PomegranateCentralServerField from '../PomegranateCentralServerField'
import PomegranateHowItWorks from '../PomegranateHowItWorks'
import PomegranateOperatorConfig from '../PomegranateOperatorConfig'

type Status = 'idle' | 'authenticating' | 'checking' | 'creating' | 'loggingIn' | 'error'

// `intro`: the single "Continue with Google" entry. `setup`: shown only after
// we learn the Google account has no key yet, where the user backs up the
// generated key and can configure operators/threshold before the account is
// created. Existing accounts skip `setup` — their operators are fixed already.
type Phase = 'intro' | 'setup'

export default function GoogleLogin({
  back,
  onLoginSuccess
}: {
  back: () => void
  onLoginSuccess: () => void
}) {
  const { t } = useTranslation()
  const { bunkerLogin } = useNostr()
  const [phase, setPhase] = useState<Phase>('intro')
  const [status, setStatus] = useState<Status>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [token, setToken] = useState<TGoogleToken | null>(null)
  const [central, setCentral] = useState(POMEGRANATE_CENTRAL_URL)
  const [secretKey, setSecretKey] = useState<Uint8Array>(() => generateSecretKey())
  const [checkedSaveKey, setCheckedSaveKey] = useState(false)
  const [copied, setCopied] = useState(false)
  const [operators, setOperators] = useState<string[]>(DEFAULT_POMEGRANATE_OPERATORS)
  const [threshold, setThreshold] = useState(() =>
    defaultPomegranateThreshold(DEFAULT_POMEGRANATE_OPERATORS.length)
  )

  const busy = status !== 'idle' && status !== 'error'
  const nsec = nsecEncode(secretKey)

  const finishLogin = async (
    googleToken: TGoogleToken,
    config: TPomegranateAccountConfig | null
  ) => {
    const { bunkerUrl, central: resolvedCentral } = await pomegranateService.finishLogin(
      central,
      googleToken,
      config,
      (s) => setStatus(s)
    )
    setStatus('loggingIn')
    await bunkerLogin(bunkerUrl, resolvedCentral)
    onLoginSuccess()
  }

  // Step 1: authenticate, then branch on whether the account already exists.
  const handleStart = async () => {
    setErrorMsg('')
    setStatus('authenticating')
    try {
      const { token: googleToken, hasAccount } = await pomegranateService.startLogin(central, (s) =>
        setStatus(s)
      )
      setToken(googleToken)
      if (hasAccount) {
        // Existing account: its operators are fixed on the server, so log in
        // directly without showing the configurable setup step.
        await finishLogin(googleToken, null)
      } else {
        // New account: let the user back up the key and review the config.
        setStatus('idle')
        setPhase('setup')
      }
    } catch (err) {
      handleError(err)
    }
  }

  // Step 2 (new accounts only): create with the shown key and chosen config.
  const handleCreate = async () => {
    if (!token) return
    setErrorMsg('')
    setStatus('creating')
    try {
      await finishLogin(token, { operators, threshold, secretKey })
    } catch (err) {
      handleError(err)
    }
  }

  const handleError = (err: unknown) => {
    const msg = describePomegranateError(err, t)
    if (!msg) {
      setStatus('idle')
      return
    }
    setStatus('error')
    setErrorMsg(msg)
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(nsec)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const statusText: Record<Exclude<Status, 'idle' | 'error'>, string> = {
    authenticating: t('Waiting for Google sign-in...'),
    checking: t('Checking your account...'),
    creating: t('Setting up your secure account...'),
    loggingIn: t('Logging in...')
  }

  const busyIndicator = busy ? (
    <div className="text-muted-foreground flex items-center justify-center gap-2 py-4 text-sm">
      <Loader className="size-4 animate-spin" />
      {statusText[status as Exclude<Status, 'idle' | 'error'>]}
    </div>
  ) : (
    status === 'error' && <p className="text-destructive text-center text-sm">{errorMsg}</p>
  )

  if (phase === 'setup') {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <h3 className="text-lg font-semibold">{t('Create your account')}</h3>
        </div>

        <InfoCard
          variant="info"
          title={t('New account')}
          content={t(
            'No account exists for this Google login yet. A new Nostr key has been created for you.'
          )}
        />

        <InfoCard
          variant="alert"
          title={t('Critical: Save Your Private Key')}
          content={t(
            'This key is yours to keep. Although you can recover it with Google, save a backup now so you never lose access to your account.'
          )}
        />

        <AdvancedOptions>
          <PomegranateOperatorConfig
            operators={operators}
            onOperatorsChange={setOperators}
            threshold={threshold}
            onThresholdChange={setThreshold}
            disabled={busy}
          />
        </AdvancedOptions>

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
              onClick={() => setSecretKey(generateSecretKey())}
              title={t('Generate new key')}
              disabled={busy}
            >
              <RefreshCcw />
            </Button>
          </div>
        </div>

        <div className="flex w-full flex-wrap gap-2">
          <Button
            onClick={() => downloadTextFile('nostr-private-key.txt', nsec)}
            className="flex-1"
            disabled={busy}
          >
            <Download />
            {t('Download Backup File')}
          </Button>
          <Button onClick={handleCopy} variant="secondary" className="flex-1" disabled={busy}>
            {copied ? <Check /> : <Copy />}
            {copied ? t('Copied to Clipboard') : t('Copy to Clipboard')}
          </Button>
        </div>

        <div className="ms-2 flex items-center gap-2">
          <Checkbox
            id="google-acknowledge-checkbox"
            checked={checkedSaveKey}
            onCheckedChange={(c) => setCheckedSaveKey(!!c)}
            disabled={busy}
          />
          <Label htmlFor="google-acknowledge-checkbox" className="cursor-pointer">
            {t('I have safely backed up my private key')}
          </Label>
        </div>

        {busyIndicator}

        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              setPhase('intro')
              setToken(null)
              setStatus('idle')
              setErrorMsg('')
            }}
            className="w-fit px-6"
            disabled={busy}
          >
            {t('Back')}
          </Button>
          <Button onClick={handleCreate} className="flex-1" disabled={busy || !checkedSaveKey}>
            {status === 'error' ? t('Try again') : t('Create account')}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="mb-2 text-lg font-semibold">{t('Login with Google')}</h3>
        <p className="text-muted-foreground text-sm">
          {t(
            'Sign in with Google to log in, or to create a new Nostr key automatically if you do not have one yet.'
          )}
        </p>
      </div>

      <PomegranateHowItWorks />

      <AdvancedOptions>
        <PomegranateCentralServerField
          central={central}
          onCentralChange={setCentral}
          disabled={busy}
        />
      </AdvancedOptions>

      {busyIndicator}

      <div className="flex gap-2">
        <Button variant="secondary" onClick={back} className="w-fit px-6" disabled={busy}>
          {t('Back')}
        </Button>
        <Button onClick={handleStart} className="flex-1" disabled={busy || !central.trim()}>
          {status === 'error' ? t('Try again') : t('Continue with Google')}
        </Button>
      </div>
    </div>
  )
}
