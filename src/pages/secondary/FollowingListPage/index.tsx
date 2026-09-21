import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import ProfileList from '@/components/ProfileList'
import { useFetchFollowings, useFetchProfile } from '@/hooks'
import SecondaryPageLayout from '@/layouts/SecondaryPageLayout'
import { useFollowList } from '@/providers/FollowListProvider'
import { useNostr } from '@/providers/NostrProvider'
import { Lock } from 'lucide-react'
import { forwardRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

const FollowingListPage = forwardRef(({ id, index }: { id?: string; index?: number }, ref) => {
  const { t } = useTranslation()
  const { pubkey: accountPubkey } = useNostr()
  const { profile } = useFetchProfile(id)
  const { followings } = useFetchFollowings(profile?.pubkey)
  const { convertAllToPrivate } = useFollowList()
  const [converting, setConverting] = useState(false)
  const isOwnList = !!accountPubkey && profile?.pubkey === accountPubkey

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
      {isOwnList && followings.length > 0 && (
        <div className="flex justify-end px-4 pt-2">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" disabled={converting}>
                <Lock className="mr-1.5 size-3.5" />
                {converting ? t('Moving...') : t('Make all follows private')}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t('Make all follows private')}?</AlertDialogTitle>
                <AlertDialogDescription>
                  {t(
                    'Your public follow list will be moved to your encrypted private follow list. Other people will no longer be able to see who you follow.'
                  )}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t('Cancel')}</AlertDialogCancel>
                <AlertDialogAction
                  onClick={async () => {
                    setConverting(true)
                    await convertAllToPrivate()
                    setConverting(false)
                  }}
                >
                  {t('Make all follows private')}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}
      <ProfileList pubkeys={followings} />
    </SecondaryPageLayout>
  )
})
FollowingListPage.displayName = 'FollowingListPage'
export default FollowingListPage
