import FollowButton from '@/components/FollowButton'
import Nip05 from '@/components/Nip05'
import NoteList from '@/components/NoteList'
import ProfileAbout from '@/components/ProfileAbout'
import ProfileBanner from '@/components/ProfileBanner'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { useFetchFollowings, useFetchProfile } from '@/hooks'
import { useFetchRelayList } from '@/hooks/useFetchRelayList'
import SecondaryPageLayout from '@/layouts/SecondaryPageLayout'
import { toFollowingList } from '@/lib/link'
import { generateImageByPubkey } from '@/lib/pubkey'
import { SecondaryPageLink } from '@/PageManager'
import { useFollowList } from '@/providers/FollowListProvider'
import { useNostr } from '@/providers/NostrProvider'
import { useRelaySettings } from '@/providers/RelaySettingsProvider'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import NotFoundPage from '../NotFoundPage'
import PubkeyCopy from './PubkeyCopy'
import QrCodePopover from './QrCodePopover'

export default function ProfilePage({ id }: { id?: string }) {
  const { t } = useTranslation()
  const { profile, isFetching } = useFetchProfile(id)
  const { relayList, isFetching: isFetchingRelayInfo } = useFetchRelayList(profile?.pubkey)
  const { relayUrls: currentRelayUrls } = useRelaySettings()
  const { pubkey: accountPubkey } = useNostr()
  const { followings: selfFollowings } = useFollowList()
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
      <SecondaryPageLayout>
        <div className="max-sm:px-4">
          <div className="relative bg-cover bg-center w-full aspect-[21/9] rounded-lg mb-2">
            <Skeleton className="w-full h-full object-cover rounded-lg" />
            <Skeleton className="w-24 h-24 absolute bottom-0 left-4 translate-y-1/2 border-4 border-background rounded-full" />
          </div>
          <Skeleton className="h-5 w-28 mt-14 mb-1" />
          <Skeleton className="h-5 w-56 mt-2 my-1 rounded-full" />
        </div>
      </SecondaryPageLayout>
    )
  }
  if (!profile) return <NotFoundPage />

  const { banner, username, nip05, about, avatar, pubkey } = profile
  return (
    <SecondaryPageLayout titlebarContent={username}>
      <div className="max-sm:px-4">
        <div className="relative bg-cover bg-center w-full aspect-[21/9] rounded-lg mb-2">
          <ProfileBanner
            banner={banner}
            pubkey={pubkey}
            className="w-full h-full object-cover rounded-lg"
          />
          <Avatar className="w-24 h-24 absolute bottom-0 left-4 translate-y-1/2 border-4 border-background">
            <AvatarImage src={avatar} className="object-cover object-center" />
            <AvatarFallback>
              <img src={defaultImage} />
            </AvatarFallback>
          </Avatar>
        </div>
        <div className="flex justify-end h-8 gap-2 items-center">
          {isFollowingYou && (
            <div className="text-muted-foreground rounded-full bg-muted text-xs h-fit px-2">
              {t('Follows you')}
            </div>
          )}
          <FollowButton pubkey={pubkey} />
        </div>
        <div className="pt-2">
          <div className="text-xl font-semibold">{username}</div>
          {nip05 && <Nip05 nip05={nip05} pubkey={pubkey} />}
          <div className="flex gap-1 mt-1">
            <PubkeyCopy pubkey={pubkey} />
            <QrCodePopover pubkey={pubkey} />
          </div>
          <ProfileAbout about={about} className="text-wrap break-words whitespace-pre-wrap mt-2" />
          <SecondaryPageLink
            to={toFollowingList(pubkey)}
            className="mt-2 flex gap-1 hover:underline text-sm w-fit"
          >
            {isSelf ? selfFollowings.length : followings.length}
            <div className="text-muted-foreground">{t('Following')}</div>
          </SecondaryPageLink>
        </div>
      </div>
      <Separator className="hidden sm:block mt-4 sm:my-4" />
      {!isFetchingRelayInfo && (
        <NoteList
          filter={{ authors: [pubkey] }}
          relayUrls={relayList.write.slice(0, 5).concat(currentRelayUrls)}
          className="max-sm:mt-2"
        />
      )}
    </SecondaryPageLayout>
  )
}