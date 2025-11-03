import FollowingFavoriteDomainList from '@/components/FollowingFavoriteDomainList'
import PrimaryPageLayout from '@/layouts/PrimaryPageLayout'
import { Users } from 'lucide-react'
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
      <FollowingFavoriteDomainList />
    </PrimaryPageLayout>
  )
})
ExplorePage.displayName = 'ExplorePage'
export default ExplorePage

function ExplorePageTitlebar() {
  const { t } = useTranslation()

  return (
    <div className="flex gap-2 items-center h-full pl-3">
      <Users />
      <div className="text-lg font-semibold">{t("Following's Communities")}</div>
    </div>
  )
}
