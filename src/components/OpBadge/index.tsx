import { cn } from '@/lib/utils'
import { useTranslation } from 'react-i18next'

export default function OpBadge({ className }: { className?: string }) {
  const { t } = useTranslation()

  return (
    <div
      className={cn('bg-primary/10 flex items-center rounded-full px-2 py-0.5', className)}
      title={t('Original poster')}
    >
      <span className="text-primary text-xs leading-none">OP</span>
    </div>
  )
}
