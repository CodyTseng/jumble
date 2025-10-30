import Collapsible from '@/components/Collapsible'
import FollowButton from '@/components/FollowButton'
import Nip05 from '@/components/Nip05'
import NpubQrCode from '@/components/NpubQrCode'
import ProfileAbout from '@/components/ProfileAbout'
import ProfileBanner from '@/components/ProfileBanner'
import ProfileOptions from '@/components/ProfileOptions'
import ProfileZapButton from '@/components/ProfileZapButton'
import PubkeyCopy from '@/components/PubkeyCopy'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useFetchFollowings, useFetchProfile } from '@/hooks'
import { toMuteList, toProfileEditor } from '@/lib/link'
import { SecondaryPageLink, useSecondaryPage } from '@/PageManager'
import { useMuteList } from '@/providers/MuteListProvider'
import { useNostr } from '@/providers/NostrProvider'
import client from '@/services/client.service'
import { Link, Zap } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import NotFound from '../NotFound'
import SearchInput from '../SearchInput'
import { SimpleUserAvatar } from '../UserAvatar'
import FollowedBy from './FollowedBy'
import Followings from './Followings'
import ProfileFeed from './ProfileFeed'
import Relays from './Relays'

export default function Profile({ id }: { id?: string }) {
  const { t } = useTranslation()
  const { push } = useSecondaryPage()
  const { profile, isFetching } = useFetchProfile(id)
  const { pubkey: accountPubkey } = useNostr()
  const { mutePubkeySet } = useMuteList()
  const [searchInput, setSearchInput] = useState('')
  const [debouncedInput, setDebouncedInput] = useState(searchInput)
  const { followings } = useFetchFollowings(profile?.pubkey)
  const isFollowingYou = useMemo(() => {
    return (
      !!accountPubkey && accountPubkey !== profile?.pubkey && followings.includes(accountPubkey)
    )
  }, [followings, profile, accountPubkey])
  const [topContainerHeight, setTopContainerHeight] = useState(0)
  const isSelf = accountPubkey === profile?.pubkey
  const [topContainer, setTopContainer] = useState<HTMLDivElement | null>(null)
  const topContainerRef = useCallback((node: HTMLDivElement | null) => {
    if (node) {
      setTopContainer(node)
    }
  }, [])

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedInput(searchInput.trim())
    }, 1000)

    return () => {
      clearTimeout(handler)
    }
  }, [searchInput])

  useEffect(() => {
    if (!profile?.pubkey) return

    const forceUpdateCache = async () => {
      await Promise.all([
        client.forceUpdateRelayListEvent(profile.pubkey),
        client.fetchProfile(profile.pubkey, true)
      ])
    }
    forceUpdateCache()
  }, [profile?.pubkey])

  useEffect(() => {
    if (!topContainer) return

    const checkHeight = () => {
      setTopContainerHeight(topContainer.scrollHeight)
    }

    checkHeight()

    const observer = new ResizeObserver(() => {
      checkHeight()
    })

    observer.observe(topContainer)

    return () => {
      observer.disconnect()
    }
  }, [topContainer])

  if (!profile && isFetching) {
    return (
      <>
        <div>
          <div className="relative bg-cover bg-center mb-2">
            <Skeleton className="w-full aspect-[3/1] rounded-none" />
            <Skeleton className="w-24 h-24 absolute bottom-0 left-3 translate-y-1/2 border-4 border-background rounded-full" />
          </div>
        </div>
        <div className="px-4">
          <Skeleton className="h-5 w-28 mt-14 mb-1" />
          <Skeleton className="h-5 w-56 mt-2 my-1 rounded-full" />
        </div>
      </>
    )
  }
  if (!profile) return <NotFound />

  const { banner, username, about, pubkey, website, lightningAddress } = profile
  return (
    <>
      <div ref={topContainerRef}>
        <div className="relative bg-cover bg-center mb-2">
          <ProfileBanner banner={banner} pubkey={pubkey} className="w-full aspect-[3/1]" />
          <SimpleUserAvatar
            userId={pubkey}
            className="w-24 h-24 absolute left-3 bottom-0 translate-y-1/2 border-4 border-background rounded-full"
          />
        </div>
        <div className="px-4">
          <div className="flex justify-end h-8 gap-2 items-center">
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
              <NpubQrCode pubkey={pubkey} />
            </div>
            <Collapsible>
              <ProfileAbout
                about={about}
                className="text-wrap break-words whitespace-pre-wrap mt-2 select-text"
              />
            </Collapsible>
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
            <div className="flex justify-between items-center mt-2 text-sm">
              <div className="flex gap-4 items-center">
                <Followings pubkey={pubkey} />
                <Relays pubkey={pubkey} />
                {isSelf && (
                  <SecondaryPageLink to={toMuteList()} className="flex gap-1 hover:underline w-fit">
                    {mutePubkeySet.size}
                    <div className="text-muted-foreground">{t('Muted')}</div>
                  </SecondaryPageLink>
                )}
              </div>
              {!isSelf && <FollowedBy pubkey={pubkey} />}
            </div>
          </div>
        </div>
        <div className="px-4 pt-2 pb-0.5">
          <SearchInput
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={t('Search')}
          />
        </div>
      </div>
      <ProfileFeed pubkey={pubkey} topSpace={topContainerHeight + 100} search={debouncedInput} />
    </>
  )
}
