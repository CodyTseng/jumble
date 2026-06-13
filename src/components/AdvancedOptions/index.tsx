import { cn } from '@/lib/utils'
import { ChevronRight, SlidersHorizontal } from 'lucide-react'
import { ReactNode, useState } from 'react'
import { useTranslation } from 'react-i18next'

/**
 * A collapsed-by-default "Advanced options" disclosure. Shared so every place
 * that exposes advanced settings (Google login central server, operator/
 * threshold config, ...) looks and behaves identically.
 */
export default function AdvancedOptions({
  children,
  defaultOpen = false
}: {
  children: ReactNode
  defaultOpen?: boolean
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-muted-foreground hover:text-foreground flex w-full items-center gap-2 text-sm font-medium transition-colors"
      >
        <SlidersHorizontal className="size-4" />
        <span className="flex-1 text-start">{t('Advanced options')}</span>
        <ChevronRight
          className={cn('size-4 transition-transform rtl:-scale-x-100', open && 'rotate-90')}
        />
      </button>
      {open && <div className="bg-card space-y-4 rounded-xl border p-3">{children}</div>}
    </div>
  )
}
