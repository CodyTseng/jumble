import FollowButton from '@/components/FollowButton'
import Nip05 from '@/components/Nip05'
import NoteList from '@/components/NoteList'
import ProfileAbout from '@/components/ProfileAbout'
import ProfileBanner from '@/components/ProfileBanner'
import ProfileOptions from '@/components/ProfileOptions'
import ProfileZapButton from '@/components/ProfileZapButton'
import PubkeyCopy from '@/components/PubkeyCopy'
import QrCodePopover from '@/components/QrCodePopover'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useFetchFollowings, useFetchProfile } from '@/hooks'
import SecondaryPageLayout from '@/layouts/SecondaryPageLayout'
import { toMuteList, toProfileEditor } from '@/lib/link'
import { generateImageByPubkey } from '@/lib/pubkey'
import { SecondaryPageLink, useSecondaryPage } from '@/PageManager'
import { useMuteList } from '@/providers/MuteListProvider'
import { useNostr } from '@/providers/NostrProvider'
import { Link, Zap } from 'lucide-react'
import { forwardRef, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import NotFoundPage from '../NotFoundPage'
import Followings from './Followings'
import Relays from './Relays'

const ProfilePage = forwardRef(({ id, index }: { id?: string; index?: number }, ref) => {
  const { t } = useTranslation()
  const { push } = useSecondaryPage()
  const { profile, isFetching } = useFetchProfile(id)
  const { pubkey: accountPubkey } = useNostr()
  const { mutePubkeys } = useMuteList()
  const { followings } = useFetchFollowings(profile?.pubkey)
  const isFollowingYou = useMemo(() => {
    return (
      !!accountPubkey && accountPubkey !== profile?.pubkey && followings.includes(accountPubkey)
    )
  }, [followings, profile, accountPubkey])
  const defaultImage = useMemo(
    () => (profile?.pubkey ? generateImageByPubkey(profile?.pubkey) : ''),
    [profile]
  )
  const isSelf = accountPubkey === profile?.pubkey

  if (!profile && isFetching) {
    return (
      <SecondaryPageLayout index={index} ref={ref}>
        <div className="sm:px-4">
          <div className="relative bg-cover bg-center mb-2">
            <Skeleton className="w-full aspect-video sm:rounded-lg" />
            <Skeleton className="w-24 h-24 absolute bottom-0 left-3 translate-y-1/2 border-4 border-background rounded-full" />
          </div>
        </div>
        <div className="px-4">
          <Skeleton className="h-5 w-28 mt-14 mb-1" />
          <Skeleton className="h-5 w-56 mt-2 my-1 rounded-full" />
        </div>
      </SecondaryPageLayout>
    )
  }
  if (!profile) return <NotFoundPage />

  const { banner, username, about, avatar, pubkey, website, lightningAddress } = profile
  return (
    <SecondaryPageLayout index={index} title={username} displayScrollToTopButton ref={ref}>
      <div className="sm:px-4">
        <div className="relative bg-cover bg-center mb-2">
          <ProfileBanner
            banner={banner}
            pubkey={pubkey}
            className="w-full aspect-video sm:rounded-lg"
          />
          <Avatar className="w-24 h-24 absolute left-3 bottom-0 translate-y-1/2 border-4 border-background">
            <AvatarImage src={avatar} className="object-cover object-center" />
            <AvatarFallback>
              <img src={defaultImage} />
            </AvatarFallback>
          </Avatar>
        </div>
      </div>
      <div className="px-4">
        <div className="flex justify-end h-8 gap-2 items-center max-sm:translate-x-2">
          <ProfileOptions pubkey={pubkey} />
          {isSelf ? (
            <Button
              className="w-20 min-w-20 rounded-full"
              variant="secondary"
              onClick={() => push(toProfileEditor())}
            >
              {t('Edit')}
            </Button>
          ) : (
            <>
              {!!lightningAddress && <ProfileZapButton pubkey={pubkey} />}
              <FollowButton pubkey={pubkey} />
            </>
          )}
        </div>
        <div className="pt-2">
          <div className="flex gap-2 items-center">
            <div className="text-xl font-semibold truncate select-text">{username}</div>
            {isFollowingYou && (
              <div className="text-muted-foreground rounded-full bg-muted text-xs h-fit px-2 shrink-0">
                {t('Follows you')}
              </div>
            )}
          </div>
          <Nip05 pubkey={pubkey} />
          {lightningAddress && (
            <div className="text-sm text-yellow-400 flex gap-1 items-center select-text">
              <Zap className="size-4 shrink-0" />
              <div className="flex-1 max-w-fit w-0 truncate">{lightningAddress}</div>
            </div>
          )}
          <div className="flex gap-1 mt-1">
            <PubkeyCopy pubkey={pubkey} />
            <QrCodePopover pubkey={pubkey} />
          </div>
          <ProfileAbout
            about={about}
            className="text-wrap break-words whitespace-pre-wrap mt-2 select-text"
          />
          {website && (
            <div className="flex gap-1 items-center text-primary mt-2 truncate select-text">
              <Link size={14} className="shrink-0" />
              <a
                href={website}
                target="_blank"
                className="hover:underline truncate flex-1 max-w-fit w-0"
              >
                {website}
              </a>
            </div>
          )}
          <div className="flex gap-4 items-center mt-2 text-sm">
            <Followings pubkey={pubkey} />
            <Relays pubkey={pubkey} />
            {isSelf && (
              <SecondaryPageLink to={toMuteList()} className="flex gap-1 hover:underline w-fit">
                {mutePubkeys.length}
                <div className="text-muted-foreground">{t('Muted')}</div>
              </SecondaryPageLink>
            )}
          </div>
        </div>
      </div>
      <NoteList author={pubkey} className="mt-2" filterMutedNotes={false} />
    </SecondaryPageLayout>
  )
})
ProfilePage.displayName = 'ProfilePage'
export default ProfilePage
