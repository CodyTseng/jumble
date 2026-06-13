import ResponsiveDialog from '@/components/ResponsiveDialog'
import { Button } from '@/components/ui/button'
import {
  DEFAULT_POMEGRANATE_OPERATORS,
  defaultPomegranateThreshold,
  describePomegranateError
} from '@/lib/pomegranate'
import pomegranateService from '@/services/pomegranate.service'
import { Loader } from 'lucide-react'
import { nip19 } from 'nostr-tools'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import InfoCard from '../InfoCard'
import PomegranateOperatorConfig from '../PomegranateOperatorConfig'

type Status = 'idle' | 'authenticating' | 'checking' | 'creating' | 'done' | 'error'

export default function PomegranateBindDialog({
  open,
  onOpenChange,
  nsec,
  onBound
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  nsec: string
  onBound: (central: string) => void
}) {
  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <PomegranateBindContent
        open={open}
        nsec={nsec}
        onBound={onBound}
        onClose={() => onOpenChange(false)}
      />
    </ResponsiveDialog>
  )
}

function PomegranateBindContent({
  open,
  nsec,
  onBound,
  onClose
}: {
  open: boolean
  nsec: string
  onBound: (central: string) => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  const [status, setStatus] = useState<Status>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [operators, setOperators] = useState<string[]>(DEFAULT_POMEGRANATE_OPERATORS)
  const [threshold, setThreshold] = useState(() =>
    defaultPomegranateThreshold(DEFAULT_POMEGRANATE_OPERATORS.length)
  )

  useEffect(() => {
    if (open) {
      setStatus('idle')
      setErrorMsg('')
      setOperators(DEFAULT_POMEGRANATE_OPERATORS)
      setThreshold(defaultPomegranateThreshold(DEFAULT_POMEGRANATE_OPERATORS.length))
    }
  }, [open])

  const busy = status === 'authenticating' || status === 'checking' || status === 'creating'

  const handleBind = async () => {
    setErrorMsg('')
    setStatus('authenticating')
    try {
      const decoded = nip19.decode(nsec)
      if (decoded.type !== 'nsec') {
        throw new Error(t('Invalid private key'))
      }
      const { central } = await pomegranateService.bindAccount(
        decoded.data,
        { operators, threshold },
        (s) => setStatus(s)
      )
      onBound(central)
      setStatus('done')
    } catch (err) {
      const msg = describePomegranateError(err, t)
      if (!msg) {
        setStatus('idle')
        return
      }
      setStatus('error')
      setErrorMsg(msg)
    }
  }

  const statusText: Record<'authenticating' | 'checking' | 'creating', string> = {
    authenticating: t('Waiting for Google sign-in...'),
    checking: t('Checking your account...'),
    creating: t('Linking your account...')
  }

  if (status === 'done') {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <h3 className="mb-2 text-lg font-semibold">{t('Connected to Google')}</h3>
        </div>
        <InfoCard
          variant="success"
          title={t('All set')}
          content={t(
            'Your account is now linked to Google. You can sign in or recover your key with Google on other devices.'
          )}
        />
        <Button onClick={onClose} className="w-full">
          {t('Done')}
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="mb-2 text-lg font-semibold">{t('Connect Google account')}</h3>
        <p className="text-muted-foreground text-sm">
          {t('Link this account to Google so you can sign in and recover it with Google.')}
        </p>
      </div>

      <InfoCard
        title={t('How it works')}
        content={t(
          'Your private key is split into shards held by separate operators, so it is never stored in one place. You keep signing with your private key on this device.'
        )}
      />

      <PomegranateOperatorConfig
        operators={operators}
        onOperatorsChange={setOperators}
        threshold={threshold}
        onThresholdChange={setThreshold}
        disabled={busy}
      />

      {busy ? (
        <div className="text-muted-foreground flex items-center justify-center gap-2 py-1 text-sm">
          <Loader className="size-4 animate-spin" />
          {statusText[status]}
        </div>
      ) : (
        status === 'error' && <p className="text-destructive text-center text-sm">{errorMsg}</p>
      )}

      <Button onClick={handleBind} className="w-full" disabled={busy}>
        {status === 'error' ? t('Try again') : t('Continue with Google')}
      </Button>
    </div>
  )
}
