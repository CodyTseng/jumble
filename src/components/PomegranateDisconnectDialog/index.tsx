import ResponsiveDialog from '@/components/ResponsiveDialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { describePomegranateError } from '@/lib/pomegranate'
import { useNostr } from '@/providers/NostrProvider'
import pomegranateService from '@/services/pomegranate.service'
import { TAccountPointer } from '@/types'
import { Loader } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import InfoCard from '../InfoCard'

export default function PomegranateDisconnectDialog({
  open,
  onOpenChange,
  central,
  account
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  central: string
  account: TAccountPointer
}) {
  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <PomegranateDisconnectContent
        open={open}
        central={central}
        account={account}
        onClose={() => onOpenChange(false)}
      />
    </ResponsiveDialog>
  )
}

function PomegranateDisconnectContent({
  open,
  central,
  account,
  onClose
}: {
  open: boolean
  central: string
  account: TAccountPointer
  onClose: () => void
}) {
  const { t } = useTranslation()
  const { removeAccount } = useNostr()
  const [phase, setPhase] = useState<'confirm' | 'done'>('confirm')
  const [acknowledged, setAcknowledged] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (open) {
      setPhase('confirm')
      setAcknowledged(false)
      setLoading(false)
      setErrorMsg('')
    }
  }, [open])

  const handleDisconnect = async () => {
    setErrorMsg('')
    setLoading(true)
    try {
      await pomegranateService.disconnectAccount(central)
      setPhase('done')
    } catch (err) {
      const msg = describePomegranateError(err, t)
      if (msg) setErrorMsg(msg)
    } finally {
      setLoading(false)
    }
  }

  // The bunker account can no longer sign once the central link is gone, so
  // remove it from Jumble. The user keeps their nsec and can log back in.
  const handleFinish = () => {
    removeAccount(account)
    onClose()
  }

  if (phase === 'done') {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <h3 className="mb-2 text-lg font-semibold">{t('Disconnected from central server')}</h3>
        </div>
        <InfoCard
          title={t('What happens next')}
          content={t(
            'This account is no longer linked to the central server. To keep using it, log in again with your private key (nsec).'
          )}
        />
        <Button onClick={handleFinish} className="w-full">
          {t('Done')}
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="mb-2 text-lg font-semibold">{t('Disconnect from central server')}</h3>
      </div>
      <InfoCard
        variant="alert"
        title={t('Keep your private key safe')}
        content={t(
          'Disconnecting only removes the link between this account and the central server. Your account still exists, and you can keep using it by logging in with your private key (nsec). Before continuing, export and safely save your nsec using the "Export private key" option.'
        )}
      />
      {errorMsg && <p className="text-destructive text-center text-sm">{errorMsg}</p>}
      <div className="ms-2 flex items-center gap-2">
        <Checkbox
          id="pomegranate-disconnect-ack"
          checked={acknowledged}
          onCheckedChange={(c) => setAcknowledged(!!c)}
        />
        <Label htmlFor="pomegranate-disconnect-ack" className="cursor-pointer">
          {t('I have safely backed up my private key')}
        </Label>
      </div>
      <Button
        variant="destructive"
        onClick={handleDisconnect}
        className="w-full"
        disabled={!acknowledged || loading}
      >
        {loading && <Loader className="size-4 animate-spin" />}
        {t('Disconnect from central server')}
      </Button>
    </div>
  )
}
