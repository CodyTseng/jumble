import { cn } from '@/lib/utils'
import { Images } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export default function HiddenMediaBar({
  count,
  className,
  onClick
}: {
  count: number
  className?: string
  onClick: (e: React.MouseEvent) => void
}) {
  const { t } = useTranslation()

  return (
    <div
      className={cn(
        'bg-muted/40 text-muted-foreground hover:bg-muted mt-2 flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors',
        className
      )}
      onClick={(e) => {
        e.stopPropagation()
        onClick(e)
      }}
    >
      <Images className="size-4" />
      <span>{t('Show {{count}} media', { count })}</span>
    </div>
  )
}
