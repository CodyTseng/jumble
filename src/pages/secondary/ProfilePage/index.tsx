import Profile from '@/components/Profile'
import ProfileOptions from '@/components/ProfileOptions'
import ProfileShareButton from '@/components/ProfileShareButton'
import { useFetchProfile } from '@/hooks'
import SecondaryPageLayout from '@/layouts/SecondaryPageLayout'
import { useNostr } from '@/providers/NostrProvider'
import { forwardRef } from 'react'

const ProfilePage = forwardRef(({ id, index }: { id?: string; index?: number }, ref) => {
  const { profile } = useFetchProfile(id)
  const { pubkey: accountPubkey } = useNostr()

  return (
    <SecondaryPageLayout
      index={index}
      title={profile?.username}
      controlsWidth={profile?.pubkey !== accountPubkey ? '5rem' : undefined}
      displayScrollToTopButton
      ref={ref}
      controls={
        profile?.pubkey ? (
          <div className="flex items-center">
            <ProfileShareButton pubkey={profile.pubkey} />
            {profile.pubkey !== accountPubkey && (
              <ProfileOptions pubkey={profile.pubkey} variant="ghost" size="titlebar-icon" />
            )}
          </div>
        ) : undefined
      }
    >
      <Profile id={id} />
    </SecondaryPageLayout>
  )
})
ProfilePage.displayName = 'ProfilePage'
export default ProfilePage
