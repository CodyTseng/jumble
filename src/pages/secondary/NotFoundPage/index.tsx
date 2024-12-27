import SecondaryPageLayout from '@/layouts/SecondaryPageLayout'
import { useTranslation } from 'react-i18next'

export default function NotFoundPage({ index }: { index?: number }) {
  const { t } = useTranslation()

  return (
    <SecondaryPageLayout index={index} hideBackButton>
      <div className="text-muted-foreground w-full h-full flex flex-col items-center justify-center gap-2">
        <div>{t('Lost in the void')} 🌌</div>
        <div>(404)</div>
      </div>
    </SecondaryPageLayout>
  )
}
