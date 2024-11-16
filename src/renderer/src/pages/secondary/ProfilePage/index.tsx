import FollowButton from '@renderer/components/FollowButton'
import Nip05 from '@renderer/components/Nip05'
import NoteList from '@renderer/components/NoteList'
import ProfileAbout from '@renderer/components/ProfileAbout'
import ProfileBanner from '@renderer/components/ProfileBanner'
import { Avatar, AvatarFallback, AvatarImage } from '@renderer/components/ui/avatar'
import { Separator } from '@renderer/components/ui/separator'
import { useFetchFollowings, useFetchProfile } from '@renderer/hooks'
import { useFetchRelayList } from '@renderer/hooks/useFetchRelayList'
import SecondaryPageLayout from '@renderer/layouts/SecondaryPageLayout'
import { toFollowingList } from '@renderer/lib/link'
import { generateImageByPubkey } from '@renderer/lib/pubkey'
import { SecondaryPageLink } from '@renderer/PageManager'
import { useFollowList } from '@renderer/providers/FollowListProvider'
import { useNostr } from '@renderer/providers/NostrProvider'
import { useMemo } from 'react'
import PubkeyCopy from './PubkeyCopy'
import QrCodePopover from './QrCodePopover'
import LoadingPage from '../LoadingPage'
import NotFoundPage from '../NotFoundPage'

export default function ProfilePage({ id }: { id?: string }) {
  const {
    profile: { banner, username, nip05, about, avatar, pubkey },
    isFetching
  } = useFetchProfile(id)
  const relayList = useFetchRelayList(pubkey)
  const { pubkey: accountPubkey } = useNostr()
  const { followings: selfFollowings } = useFollowList()
  const { followings } = useFetchFollowings(pubkey)
  const isFollowingYou = useMemo(
    () => !!accountPubkey && accountPubkey !== pubkey && followings.includes(accountPubkey),
    [followings, pubkey]
  )
  const defaultImage = useMemo(() => (pubkey ? generateImageByPubkey(pubkey) : ''), [pubkey])
  const isSelf = accountPubkey === pubkey

  if (!pubkey && isFetching) return <LoadingPage title={username} />
  if (!pubkey) return <NotFoundPage />

  return (
    <SecondaryPageLayout titlebarContent={username}>
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
            Follows you
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
          className="mt-2 flex gap-1 hover:underline text-sm"
        >
          {isSelf ? selfFollowings.length : followings.length}
          <div className="text-muted-foreground">Following</div>
        </SecondaryPageLink>
      </div>
      <Separator className="my-4" />
      <NoteList
        key={pubkey}
        filter={{ authors: [pubkey] }}
        relayUrls={relayList.write.slice(0, 5)}
      />
    </SecondaryPageLayout>
  )
}
