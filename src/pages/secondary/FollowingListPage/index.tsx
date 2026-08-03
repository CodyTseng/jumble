import ProfileList from '@/components/ProfileList'
import { Button } from '@/components/ui/button'
import { useFetchFollowings, useFetchProfile } from '@/hooks'
import SecondaryPageLayout from '@/layouts/SecondaryPageLayout'
import { useFollowList } from '@/providers/FollowListProvider'
import { useNostr } from '@/providers/NostrProvider'
import { Loader, Lock } from 'lucide-react'
import { forwardRef, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

const FollowingListPage = forwardRef(({ id, index }: { id?: string; index?: number }, ref) => {
  const { t } = useTranslation()
  const { profile } = useFetchProfile(id)
  const { followings: remoteFollowings } = useFetchFollowings(profile?.pubkey)
  const { pubkey: accountPubkey } = useNostr()
  const {
    followingSet,
    publicFollowingSet,
    convertAllPublicFollowsToPrivate
  } = useFollowList()
  const [converting, setConverting] = useState(false)

  const isSelf = !!accountPubkey && !!profile?.pubkey && accountPubkey === profile.pubkey

  // For the signed-in user's list, include private follows from the provider.
  const followings = useMemo(() => {
    if (isSelf) return Array.from(followingSet)
    return remoteFollowings
  }, [isSelf, followingSet, remoteFollowings])

  const publicCount = isSelf ? publicFollowingSet.size : remoteFollowings.length

  const handleConvert = async () => {
    if (!isSelf || converting) return
    setConverting(true)
    try {
      await convertAllPublicFollowsToPrivate()
    } finally {
      setConverting(false)
    }
  }

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
      {isSelf && publicCount > 0 && (
        <div className="flex justify-end border-b px-4 py-3">
          <Button
            variant="secondary"
            size="sm"
            className="gap-1.5"
            disabled={converting}
            onClick={handleConvert}
          >
            {converting ? (
              <Loader className="size-4 animate-spin" />
            ) : (
              <Lock className="size-4" />
            )}
            {t('Convert public follows to private')}
          </Button>
        </div>
      )}
      <ProfileList pubkeys={followings} />
    </SecondaryPageLayout>
  )
})
FollowingListPage.displayName = 'FollowingListPage'
export default FollowingListPage
