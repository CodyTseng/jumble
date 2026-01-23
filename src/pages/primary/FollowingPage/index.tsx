import FollowingFeed from '@/components/FollowingFeed'
import PrimaryPageLayout from '@/layouts/PrimaryPageLayout'
import { TPageRef } from '@/types'
import { UsersRound } from 'lucide-react'
import { forwardRef } from 'react'
import { useTranslation } from 'react-i18next'

const FollowingPage = forwardRef<TPageRef>((_, ref) => {
  return (
    <PrimaryPageLayout
      pageName="following"
      titlebar={<FollowingPageTitlebar />}
      displayScrollToTopButton
      ref={ref}
    >
      <FollowingFeed />
    </PrimaryPageLayout>
  )
})
FollowingPage.displayName = 'FollowingPage'
export default FollowingPage

function FollowingPageTitlebar() {
  const { t } = useTranslation()

  return (
    <div className="flex h-full items-center gap-2 pl-3">
      <UsersRound />
      <div className="text-lg font-semibold">{t('Following')}</div>
    </div>
  )
}
