import { useSecondaryPage } from '@/PageManager'
import { Button } from '@/components/ui/button'
import { toRelayActivity } from '@/lib/link'
import { Activity } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export default function RelayActivityButton({ url }: { url: string }) {
  const { t } = useTranslation()
  const { push } = useSecondaryPage()
  return (
    <Button
      variant="ghost"
      size="titlebar-icon"
      title={t('Metrics')}
      aria-label={t('Metrics')}
      onClick={() => push(toRelayActivity(url))}
    >
      <Activity className="size-4" />
    </Button>
  )
}
