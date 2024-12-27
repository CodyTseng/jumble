import SecondaryPageLayout from '@/layouts/SecondaryPageLayout'
import { useTranslation } from 'react-i18next'

export default function HomePage() {
  const { t } = useTranslation()
  return (
    <SecondaryPageLayout hideBackButton hideScrollToTopButton>
      <div className="text-muted-foreground w-full h-screen flex items-center justify-center">
        {t('Welcome! 🥳')}
      </div>
    </SecondaryPageLayout>
  )
}
