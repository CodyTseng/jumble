import PinButton from '@/components/PinButton'
import Profile from '@/components/Profile'
import PrimaryPageLayout from '@/layouts/PrimaryPageLayout'
import { useNostr } from '@/providers/NostrProvider'
import { UserRound } from 'lucide-react'
import { forwardRef } from 'react'
import { useTranslation } from 'react-i18next'

const ProfilePage = forwardRef((_, ref) => {
  const { pubkey } = useNostr()

  return (
    <PrimaryPageLayout
      pageName="profile"
      titlebar={<ProfilePageTitlebar pubkey={pubkey} />}
      displayScrollToTopButton
      ref={ref}
    >
      <Profile id={pubkey ?? undefined} />
    </PrimaryPageLayout>
  )
})
ProfilePage.displayName = 'ProfilePage'
export default ProfilePage

function ProfilePageTitlebar({ pubkey }: { pubkey: string | null }) {
  const { t } = useTranslation()

  return (
    <div className="flex gap-2 items-center justify-between h-full pl-3">
      <div className="flex gap-2 items-center [&_svg]:text-muted-foreground">
        <UserRound />
        <div className="text-lg font-semibold" style={{ fontSize: `var(--title-font-size, 18px)` }}>{t('Profile')}</div>
      </div>
      {pubkey && <PinButton column={{ type: 'profile', props: { pubkey } }} size="titlebar-icon" />}
    </div>
  )
}
