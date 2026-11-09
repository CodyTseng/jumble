import Profile from '@/components/Profile'
import ProfileShareButton from '@/components/ProfileShareButton'
import PrimaryPageLayout from '@/layouts/PrimaryPageLayout'
import { useNostr } from '@/providers/NostrProvider'
import { TPageRef } from '@/types'
import { UserIcon } from '@phosphor-icons/react'
import { forwardRef } from 'react'
import { useTranslation } from 'react-i18next'

const ProfilePage = forwardRef<TPageRef>((_, ref) => {
  const { t } = useTranslation()
  const { pubkey } = useNostr()

  return (
    <PrimaryPageLayout
      pageName="profile"
      icon={<UserIcon />}
      title={t('Profile')}
      controls={pubkey ? <ProfileShareButton pubkey={pubkey} /> : undefined}
      displayScrollToTopButton
      ref={ref}
    >
      <Profile id={pubkey ?? undefined} />
    </PrimaryPageLayout>
  )
})
ProfilePage.displayName = 'ProfilePage'
export default ProfilePage
