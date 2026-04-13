import FollowingFeed from '@/components/FollowingFeed'
import PrimaryPageLayout from '@/layouts/PrimaryPageLayout'
import { TPageRef } from '@/types'
import { UsersRound } from 'lucide-react'
import { forwardRef } from 'react'
import { useTranslation } from 'react-i18next'

const FollowingPage = forwardRef<TPageRef>((_, ref) => {
  const { t } = useTranslation()
  return (
    <PrimaryPageLayout
      pageName="following"
      icon={<UsersRound />}
      title={t('Following')}
      displayScrollToTopButton
      ref={ref}
    >
      <FollowingFeed />
    </PrimaryPageLayout>
  )
})
FollowingPage.displayName = 'FollowingPage'
export default FollowingPage
