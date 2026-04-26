import { Button } from '@/components/ui/button'
import { useUpdater } from '@/providers/UpdaterProvider'
import { Check, Download, Loader2, RefreshCw, RotateCw, TriangleAlert } from 'lucide-react'
import { forwardRef, HTMLProps } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'

export default function UpdateSection() {
  const { t } = useTranslation()
  const { state, check, install } = useUpdater()

  if (!state.supported) return null

  if (state.status === 'downloaded') {
    return (
      <UpdateBanner
        icon={<Download className="text-primary" />}
        title={t('Update ready: v{{version}}', { version: state.newVersion ?? '' })}
        description={t('Restart Jumble to install the latest version.')}
        action={
          <Button size="sm" onClick={() => install()}>
            <RotateCw />
            {t('Restart now')}
          </Button>
        }
      />
    )
  }

  if (state.status === 'downloading') {
    return (
      <UpdateBanner
        icon={<Loader2 className="animate-spin text-primary" />}
        title={t('Downloading update v{{version}}…', { version: state.newVersion ?? '' })}
        description={`${state.progressPercent ?? 0}%`}
      />
    )
  }

  return (
    <SettingItem className="clickable" onClick={() => check()}>
      <div className="flex items-center gap-4">
        <CheckIcon status={state.status} />
        <div>{t('Check for updates')}</div>
      </div>
      <div className="text-sm text-muted-foreground">
        <StatusText status={state.status} newVersion={state.newVersion} error={state.error} />
      </div>
    </SettingItem>
  )
}

function CheckIcon({ status }: { status: string }) {
  if (status === 'checking') return <Loader2 className="animate-spin" />
  if (status === 'available') return <Download />
  if (status === 'not-available') return <Check />
  if (status === 'error') return <TriangleAlert className="text-destructive" />
  return <RefreshCw />
}

function StatusText({
  status,
  newVersion,
  error
}: {
  status: string
  newVersion?: string
  error?: string
}) {
  const { t } = useTranslation()
  if (status === 'checking') return <>{t('Checking…')}</>
  if (status === 'not-available') return <>{t("You're up to date")}</>
  if (status === 'available')
    return <>{t('New version v{{version}} found', { version: newVersion ?? '' })}</>
  if (status === 'error') return <span className="text-destructive">{error || t('Update failed')}</span>
  return null
}

function UpdateBanner({
  icon,
  title,
  description,
  action
}: {
  icon: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
}) {
  return (
    <div className="m-4 flex items-center justify-between gap-4 rounded-lg border border-primary/30 bg-primary/5 p-4 [&_svg]:size-5">
      <div className="flex items-center gap-4">
        {icon}
        <div>
          <div className="font-medium">{title}</div>
          {description && (
            <div className="text-sm text-muted-foreground">{description}</div>
          )}
        </div>
      </div>
      {action}
    </div>
  )
}

const SettingItem = forwardRef<HTMLDivElement, HTMLProps<HTMLDivElement>>(
  ({ children, className, ...props }, ref) => {
    return (
      <div
        className={cn(
          'flex h-[52px] select-none items-center justify-between rounded-lg px-4 py-2 [&_svg]:size-4 [&_svg]:shrink-0',
          className
        )}
        {...props}
        ref={ref}
      >
        {children}
      </div>
    )
  }
)
SettingItem.displayName = 'SettingItem'
