import SecondaryPageLayout from '@/layouts/SecondaryPageLayout'
import { forwardRef } from 'react'
import { useTranslation } from 'react-i18next'

const HomePage = forwardRef(({ index }: { index?: number }, ref) => {
  const { t } = useTranslation()
  return (
    <SecondaryPageLayout ref={ref} index={index} hideBackButton>
      <div className="text-muted-foreground w-full h-screen flex items-center justify-center">
        {t('Welcome! 🥳')}
      </div>
    </SecondaryPageLayout>
  )
})
HomePage.displayName = 'HomePage'
export default HomePage
