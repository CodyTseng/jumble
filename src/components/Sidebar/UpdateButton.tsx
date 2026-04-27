import { cn } from '@/lib/utils'
import { useUpdater } from '@/providers/UpdaterProvider'
import { Loader2, RotateCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export default function UpdateButton({ collapse }: { collapse: boolean }) {
  const { t } = useTranslation()
  const { state, install } = useUpdater()

  if (!state.supported) return null
  if (state.status !== 'downloaded' && state.status !== 'downloading') return null

  const isDownloading = state.status === 'downloading'
  const fullLabel = isDownloading
    ? t('Downloading update v{{version}}…', { version: state.newVersion ?? '' })
    : t('Update ready: v{{version}}', { version: state.newVersion ?? '' })

  const baseClasses =
    'cursor-pointer text-primary transition-colors disabled:cursor-not-allowed disabled:opacity-70 [&_svg]:size-5 [&_svg]:shrink-0'

  if (collapse) {
    return (
      <button
        type="button"
        disabled={isDownloading}
        title={fullLabel}
        className={cn(
          baseClasses,
          'flex size-12 items-center justify-center rounded-lg border border-primary/40 bg-primary/10 hover:bg-primary/15'
        )}
        onClick={() => !isDownloading && install()}
      >
        {isDownloading ? <Loader2 className="animate-spin" /> : <RotateCw />}
      </button>
    )
  }

  return (
    <button
      type="button"
      disabled={isDownloading}
      title={fullLabel}
      className={cn(
        baseClasses,
        'flex w-full items-center gap-3 rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-start hover:bg-primary/15'
      )}
      onClick={() => !isDownloading && install()}
    >
      {isDownloading ? <Loader2 className="animate-spin" /> : <RotateCw />}
      <div className="flex min-w-0 flex-1 flex-col items-start">
        {isDownloading ? (
          <div className="text-xs font-medium leading-tight">{`${state.progressPercent ?? 0}%`}</div>
        ) : (
          <>
            <div className="truncate text-xs font-medium leading-tight">{`v${state.newVersion ?? ''}`}</div>
            <div className="text-[11px] leading-tight opacity-80">{t('Restart now')}</div>
          </>
        )}
      </div>
    </button>
  )
}
