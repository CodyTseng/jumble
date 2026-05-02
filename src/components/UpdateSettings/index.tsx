import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useUpdater } from '@/providers/UpdaterProvider'
import { Loader2, RotateCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export default function UpdateSettings() {
  const { t } = useTranslation()
  const { state, setAutoUpdate } = useUpdater()

  if (!state.supported) return null

  return (
    <div className="space-y-4">
      <div className="flex min-h-9 items-center justify-between px-4">
        <Label htmlFor="auto-update" className="text-base font-normal">
          <div>{t('Automatic updates')}</div>
          <div className="text-muted-foreground">
            {t('Check for and download updates in the background')}
          </div>
        </Label>
        <Switch
          id="auto-update"
          checked={state.autoUpdateEnabled}
          onCheckedChange={(checked) => setAutoUpdate(checked)}
        />
      </div>

      <div className="space-y-2 px-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-base">{t('Check for updates')}</div>
            <UpdateStatusLine />
          </div>
          <UpdateActionButton />
        </div>
      </div>
    </div>
  )
}

function UpdateStatusLine() {
  const { t } = useTranslation()
  const { state } = useUpdater()

  const version = `v${state.currentVersion}`

  switch (state.status) {
    case 'checking':
      return <div className="text-sm text-muted-foreground">{t('Checking for updates…')}</div>
    case 'available':
      return (
        <div className="text-sm text-muted-foreground">
          {t('Update available: v{{version}}', { version: state.newVersion ?? '' })}
        </div>
      )
    case 'not-available':
      return (
        <div className="text-sm text-muted-foreground">
          {t('You are on the latest version ({{version}})', { version })}
        </div>
      )
    case 'downloading':
      return (
        <div className="text-sm text-muted-foreground">
          {t('Downloading update v{{version}}…', { version: state.newVersion ?? '' })}
          {typeof state.progressPercent === 'number' ? ` ${state.progressPercent}%` : null}
        </div>
      )
    case 'downloaded':
      return (
        <div className="text-sm text-muted-foreground">
          {t('Update ready: v{{version}}', { version: state.newVersion ?? '' })}
        </div>
      )
    case 'error':
      return (
        <div className="text-sm text-destructive">
          {state.error ?? t('Failed to check for updates')}
        </div>
      )
    default:
      return <div className="text-sm text-muted-foreground">{version}</div>
  }
}

function UpdateActionButton() {
  const { t } = useTranslation()
  const { state, check, download, install } = useUpdater()

  if (state.status === 'downloaded') {
    return (
      <Button size="sm" onClick={install}>
        {t('Restart now')}
      </Button>
    )
  }

  if (state.status === 'available' && !state.autoUpdateEnabled) {
    return (
      <Button size="sm" onClick={download}>
        {t('Download')}
      </Button>
    )
  }

  if (state.status === 'downloading') {
    return (
      <Button size="sm" disabled>
        <Loader2 className="animate-spin" />
      </Button>
    )
  }

  const isChecking = state.status === 'checking'
  return (
    <Button size="sm" variant="secondary" onClick={check} disabled={isChecking}>
      {isChecking ? <Loader2 className="animate-spin" /> : <RotateCw />}
      {t('Check')}
    </Button>
  )
}
