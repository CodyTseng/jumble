import RelayList from '@/components/RelayList'
import SecondaryPageLayout from '@/layouts/SecondaryPageLayout'
import { Compass } from 'lucide-react'
import { forwardRef } from 'react'
import { useTranslation } from 'react-i18next'

const HomePage = forwardRef(({ index }: { index?: number }, ref) => {
  const { t } = useTranslation()

  return (
    <SecondaryPageLayout
      ref={ref}
      index={index}
      title={
        <>
          <Compass />
          <div>{t('Explore')}</div>
        </>
      }
      displayScrollToTopButton
      hideBackButton
    >
      <RelayList />
    </SecondaryPageLayout>
  )
})
HomePage.displayName = 'HomePage'
export default HomePage
