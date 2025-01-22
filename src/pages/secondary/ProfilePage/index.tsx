import FollowButton from '@/components/FollowButton'
import Nip05 from '@/components/Nip05'
import NoteList from '@/components/NoteList'
import ProfileAbout from '@/components/ProfileAbout'
import ProfileBanner from '@/components/ProfileBanner'
import PubkeyCopy from '@/components/PubkeyCopy'
import QrCodePopover from '@/components/QrCodePopover'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useFetchFollowings, useFetchProfile } from '@/hooks'
import { useFetchRelayList } from '@/hooks/useFetchRelayList'
import SecondaryPageLayout from '@/layouts/SecondaryPageLayout'
import {
  toFollowingList,
  toMuteList,
  toOthersRelaySettings,
  toProfileEditor,
  toRelaySettings
} from '@/lib/link'
import { generateImageByPubkey } from '@/lib/pubkey'
import { SecondaryPageLink, useSecondaryPage } from '@/PageManager'
import { useFeed } from '@/providers/FeedProvider'
import { useFollowList } from '@/providers/FollowListProvider'
import { useMuteList } from '@/providers/MuteListProvider'
import { useNostr } from '@/providers/NostrProvider'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import NotFoundPage from '../NotFoundPage'
import ProfileOptions from '@/components/ProfileOptions'

export default function ProfilePage({ id, index }: { id?: string; index?: number }) {
  const { t } = useTranslation()
  const { push } = useSecondaryPage()
  const { profile, isFetching } = useFetchProfile(id)
  const { relayList, isFetching: isFetchingRelayInfo } = useFetchRelayList(profile?.pubkey)
  const { relayUrls: currentRelayUrls } = useFeed()
  const relayUrls = useMemo(
    () =>
      relayList.write.length < 4
        ? relayList.write.concat(currentRelayUrls).slice(0, 4)
        : relayList.write.slice(0, 4),
    [relayList, currentRelayUrls]
  )
  const { pubkey: accountPubkey } = useNostr()
  const { followings: selfFollowings } = useFollowList()
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
      <SecondaryPageLayout index={index}>
        <div className="px-4">
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
    <SecondaryPageLayout index={index} title={username} displayScrollToTopButton>
      <div className="px-4">
        <div className="relative bg-cover bg-center w-full aspect-[21/9] rounded-lg mb-2">
          <ProfileBanner
            banner={banner}
            pubkey={pubkey}
            className="w-full aspect-video object-cover rounded-lg"
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
          {isSelf ? (
            <Button
              className="w-20 min-w-20 rounded-full"
              variant="secondary"
              onClick={() => push(toProfileEditor())}
            >
              {t('Edit')}
            </Button>
          ) : (
            <FollowButton pubkey={pubkey} />
          )}
          <ProfileOptions pubkey={pubkey} />
        </div>
        <div className="pt-2">
          <div className="text-xl font-semibold">{username}</div>
          {nip05 && <Nip05 nip05={nip05} pubkey={pubkey} />}
          <div className="flex gap-1 mt-1">
            <PubkeyCopy pubkey={pubkey} />
            <QrCodePopover pubkey={pubkey} />
          </div>
          <ProfileAbout about={about} className="text-wrap break-words whitespace-pre-wrap mt-2" />
          <div className="flex gap-4 items-center mt-2 text-sm">
            <SecondaryPageLink
              to={toFollowingList(pubkey)}
              className="flex gap-1 hover:underline w-fit"
            >
              {isSelf ? selfFollowings.length : followings.length}
              <div className="text-muted-foreground">{t('Following')}</div>
            </SecondaryPageLink>
            <SecondaryPageLink
              to={isSelf ? toRelaySettings('mailbox') : toOthersRelaySettings(pubkey)}
              className="flex gap-1 hover:underline w-fit"
            >
              {relayList.originalRelays.length}
              <div className="text-muted-foreground">{t('Relays')}</div>
            </SecondaryPageLink>
            {isSelf && (
              <SecondaryPageLink to={toMuteList()} className="flex gap-1 hover:underline w-fit">
                {mutePubkeys.length}
                <div className="text-muted-foreground">{t('Muted')}</div>
              </SecondaryPageLink>
            )}
          </div>
        </div>
      </div>
      {!isFetchingRelayInfo && (
        <NoteList
          filter={{ authors: [pubkey] }}
          relayUrls={relayUrls}
          className="mt-2"
          filterMutedNotes={false}
        />
      )}
    </SecondaryPageLayout>
  )
}
