import { Button } from '@/components/ui/button'
import { useNostr } from '@/providers/NostrProvider'
import { useDraftCounts } from '@/services/post-draft.service'
import { useTranslation } from 'react-i18next'

export default function DraftsButton({ onClick }: { onClick: () => void }) {
  const { t } = useTranslation()
  const { pubkey } = useNostr()
  const counts = useDraftCounts(pubkey ?? undefined)
  const badge = counts.draft + counts.failed

  return (
    <Button
      type="button"
      variant="ghost"
      onClick={onClick}
      className="relative text-muted-foreground hover:text-foreground"
    >
      {t('Drafts')}
      {badge > 0 && (
        <span className="absolute -end-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground">
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </Button>
  )
}
