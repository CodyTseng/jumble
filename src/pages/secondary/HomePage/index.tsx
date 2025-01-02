import SecondaryPageLayout from '@/layouts/SecondaryPageLayout'
import { useTranslation } from 'react-i18next'

export default function HomePage({ index }: { index?: number }) {
  const { t } = useTranslation()
  return (
    <SecondaryPageLayout index={index} hideBackButton>
      <div className="text-muted-foreground w-full h-screen flex items-center justify-center">
        {t('Welcome! 🥳')}
      </div>
    </SecondaryPageLayout>
  )
}
