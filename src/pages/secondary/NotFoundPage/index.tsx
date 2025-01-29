import SecondaryPageLayout from '@/layouts/SecondaryPageLayout'
import { forwardRef } from 'react'
import { useTranslation } from 'react-i18next'

const NotFoundPage = forwardRef(({ index }: { index?: number }, ref) => {
  const { t } = useTranslation()

  return (
    <SecondaryPageLayout ref={ref} index={index} hideBackButton>
      <div className="text-muted-foreground w-full h-full flex flex-col items-center justify-center gap-2">
        <div>{t('Lost in the void')} 🌌</div>
        <div>(404)</div>
      </div>
    </SecondaryPageLayout>
  )
})
NotFoundPage.displayName = 'NotFoundPage'
export default NotFoundPage
