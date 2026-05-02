import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { isElectron } from '@/lib/platform'
import { cn } from '@/lib/utils'
import { useUpdater } from '@/providers/UpdaterProvider'
import { Loader2, RotateCw } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

export default function UpdateSettings() {
  const { t } = useTranslation()
  const { state, setAutoUpdate } = useUpdater()

  if (!isElectron()) return null

  const hasNewVersion = state.status === 'available' || state.status === 'downloaded'

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
            <div className="flex items-center gap-2 text-base">
              {t('Check for updates')}
              {hasNewVersion && (
                <span className="rounded-full bg-primary px-1.5 py-0.5 text-xs font-medium leading-none text-primary-foreground">
                  {t('NEW')}
                </span>
              )}
            </div>
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
  const [localChecking, setLocalChecking] = useState(false)
  const prevStatusRef = useRef(state.status)

  useEffect(() => {
    const prev = prevStatusRef.current
    prevStatusRef.current = state.status
    if (prev !== 'checking') return
    if (state.status === 'not-available') {
      toast.success(t('You are on the latest version ({{version}})', { version: `v${state.currentVersion}` }))
    } else if (state.status === 'available') {
      toast.info(t('Update available: v{{version}}', { version: state.newVersion ?? '' }))
    } else if (state.status === 'error') {
      toast.error(state.error ?? t('Failed to check for updates'))
    }
  }, [state.status, state.currentVersion, state.newVersion, state.error, t])

  const handleCheck = async () => {
    setLocalChecking(true)
    try {
      await check()
    } finally {
      setLocalChecking(false)
    }
  }

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

  const isChecking = localChecking || state.status === 'checking'
  return (
    <Button size="sm" variant="secondary" onClick={handleCheck} disabled={isChecking}>
      <RotateCw className={cn(isChecking && 'animate-spin')} />
      {t('Check')}
    </Button>
  )
}
