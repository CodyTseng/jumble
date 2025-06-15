import SecondaryPageLayout from '@/layouts/SecondaryPageLayout'
import { forwardRef } from 'react'
import { useTranslation } from 'react-i18next'
import { JumbleTranslation } from './JumbleTranslation'

const TranslationPage = forwardRef(({ index }: { index?: number }, ref) => {
  const { t } = useTranslation()

  return (
    <SecondaryPageLayout ref={ref} index={index} title={t('Translation')}>
      <div className="px-4 pt-2 space-y-4">
        <JumbleTranslation />
      </div>
    </SecondaryPageLayout>
  )
})
TranslationPage.displayName = 'TranslationPage'
export default TranslationPage
