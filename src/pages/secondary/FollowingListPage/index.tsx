import ProfileList from '@/components/ProfileList'
import { useFetchFollowings, useFetchProfile } from '@/hooks'
import SecondaryPageLayout from '@/layouts/SecondaryPageLayout'
import { forwardRef } from 'react'
import { useTranslation } from 'react-i18next'

const FollowingListPage = forwardRef(({ id, index }: { id?: string; index?: number }, ref) => {
  const { t } = useTranslation()
  const { profile } = useFetchProfile(id)
  const { followings } = useFetchFollowings(profile?.pubkey)

  return (
    <SecondaryPageLayout
      ref={ref}
      index={index}
      title={
        profile?.username
          ? t("username's following", { username: profile.username })
          : t('Following')
      }
      displayScrollToTopButton
    >
      <ProfileList pubkeys={followings} />
    </SecondaryPageLayout>
  )
})
FollowingListPage.displayName = 'FollowingListPage'
export default FollowingListPage
