import ResponsiveDialog from '@/components/ResponsiveDialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SettingsGroup, SettingsRow } from '@/components/ui/settings'
import { downloadTextFile } from '@/lib/download'
import { describePomegranateError } from '@/lib/pomegranate'
import pomegranateService, {
  TPomegranateAccount,
  TPomegranateOperator
} from '@/services/pomegranate.service'
import { Check, Copy, Download, Loader } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import InfoCard from '../InfoCard'

type Phase = 'intro' | 'recovering' | 'done'

function operatorLabel(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return url
  }
}

export default function PomegranateExportDialog({
  open,
  onOpenChange,
  central,
  pubkey
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  central: string
  pubkey: string
}) {
  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <PomegranateExportContent open={open} central={central} pubkey={pubkey} />
    </ResponsiveDialog>
  )
}

function PomegranateExportContent({
  open,
  central,
  pubkey
}: {
  open: boolean
  central: string
  pubkey: string
}) {
  const { t } = useTranslation()
  const [phase, setPhase] = useState<Phase>('intro')
  const [loading, setLoading] = useState(false)
  const [account, setAccount] = useState<TPomegranateAccount | null>(null)
  const [shardByOperator, setShardByOperator] = useState<Record<string, string>>({})
  const [recoveringUrl, setRecoveringUrl] = useState('')
  const [nsec, setNsec] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (open) {
      setPhase('intro')
      setLoading(false)
      setAccount(null)
      setShardByOperator({})
      setRecoveringUrl('')
      setNsec('')
      setErrorMsg('')
      setCopied(false)
    }
  }, [open])

  const handleStart = async () => {
    setErrorMsg('')
    setLoading(true)
    try {
      const result = await pomegranateService.startRecovery(central)
      setAccount(result.account)
      setPhase('recovering')
    } catch (err) {
      const msg = describePomegranateError(err, t)
      if (msg) setErrorMsg(msg)
    } finally {
      setLoading(false)
    }
  }

  const handleRecoverShard = async (operator: TPomegranateOperator) => {
    if (!account) return
    setErrorMsg('')
    setRecoveringUrl(operator.url)
    try {
      const shard = await pomegranateService.recoverShard(operator)
      const next = { ...shardByOperator, [operator.url]: shard }
      setShardByOperator(next)
      if (Object.keys(next).length >= account.threshold) {
        const shards = Object.values(next).slice(0, account.threshold)
        setNsec(pomegranateService.aggregateNsec(shards, pubkey))
        setPhase('done')
      }
    } catch (err) {
      const msg = describePomegranateError(err, t)
      if (msg) setErrorMsg(msg)
    } finally {
      setRecoveringUrl('')
    }
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(nsec)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (phase === 'done') {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <h3 className="mb-2 text-lg font-semibold">{t('Your Private Key')}</h3>
        </div>
        <InfoCard
          variant="alert"
          title={t('Keep your private key safe')}
          content={t(
            'Anyone with this key has full control of your account. Store it somewhere secure and never share it.'
          )}
        />
        <Input
          value={nsec}
          readOnly
          className="font-mono text-sm"
          onClick={(e) => e.currentTarget.select()}
        />
        <div className="flex w-full flex-wrap gap-2">
          <Button
            onClick={() => downloadTextFile('nostr-private-key.txt', nsec)}
            className="flex-1"
          >
            <Download />
            {t('Download Backup File')}
          </Button>
          <Button onClick={handleCopy} variant="secondary" className="flex-1">
            {copied ? <Check /> : <Copy />}
            {copied ? t('Copied to Clipboard') : t('Copy to Clipboard')}
          </Button>
        </div>
      </div>
    )
  }

  if (phase === 'recovering' && account) {
    const recoveredCount = Object.keys(shardByOperator).length
    return (
      <div className="space-y-6">
        <div className="text-center">
          <h3 className="mb-2 text-lg font-semibold">{t('Export private key')}</h3>
          <p className="text-muted-foreground text-sm">
            {t('Recovered {{count}} of {{total}} shards', {
              count: recoveredCount,
              total: account.threshold
            })}
          </p>
        </div>
        <p className="text-muted-foreground text-sm">
          {t('Recover one shard at a time. Each step opens a window to sign in with the operator.')}
        </p>
        <SettingsGroup>
          {account.operators.map((operator) => {
            const recovered = shardByOperator[operator.url] !== undefined
            const recovering = recoveringUrl === operator.url
            return (
              <SettingsRow
                key={operator.url}
                title={operatorLabel(operator.url)}
                control={
                  recovered ? (
                    <Check className="size-4 text-green-500" />
                  ) : (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleRecoverShard(operator)}
                      disabled={recoveringUrl !== ''}
                    >
                      {recovering && <Loader className="size-4 animate-spin" />}
                      {recovering ? t('Recovering...') : t('Recover')}
                    </Button>
                  )
                }
              />
            )
          })}
        </SettingsGroup>
        {errorMsg && <p className="text-destructive text-center text-sm">{errorMsg}</p>}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="mb-2 text-lg font-semibold">{t('Export private key')}</h3>
        <p className="text-muted-foreground text-sm">
          {t('Recover your private key by collecting shards from the operators.')}
        </p>
      </div>
      <InfoCard
        variant="alert"
        title={t('Keep your private key safe')}
        content={t(
          'This reassembles your full private key in this browser. Only continue on a device you trust.'
        )}
      />
      {errorMsg && <p className="text-destructive text-center text-sm">{errorMsg}</p>}
      <Button onClick={handleStart} className="w-full" disabled={loading}>
        {loading && <Loader className="size-4 animate-spin" />}
        {t('Start recovery')}
      </Button>
    </div>
  )
}
