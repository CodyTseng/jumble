import RelayList from '@/components/RelayList'
import PrimaryPageLayout from '@/layouts/PrimaryPageLayout'
import { Compass } from 'lucide-react'
import { forwardRef } from 'react'
import { useTranslation } from 'react-i18next'

const ExplorePage = forwardRef((_, ref) => {
  return (
    <PrimaryPageLayout
      ref={ref}
      pageName="explore"
      titlebar={<ExplorePageTitlebar />}
      displayScrollToTopButton
    >
      <RelayList />
    </PrimaryPageLayout>
  )
})
ExplorePage.displayName = 'ExplorePage'
export default ExplorePage

function ExplorePageTitlebar() {
  const { t } = useTranslation()

  return (
    <div className="flex gap-2 items-center h-full pl-3">
      <Compass />
      <div className="text-lg font-semibold">{t('Explore')}</div>
    </div>
  )
}
