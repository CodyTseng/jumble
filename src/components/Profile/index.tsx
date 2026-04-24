import Collapsible from '@/components/Collapsible'
import FollowButton from '@/components/FollowButton'
import Nip05 from '@/components/Nip05'
import NpubQrCode from '@/components/NpubQrCode'
import ProfileAbout from '@/components/ProfileAbout'
import ProfileZapButton from '@/components/ProfileZapButton'
import PubkeyCopy from '@/components/PubkeyCopy'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useDmSupport, useFetchFollowings, useFetchProfile } from '@/hooks'
import { toDmConversation, toMuteList, toProfileEditor } from '@/lib/link'
import { SecondaryPageLink, useSecondaryPage } from '@/PageManager'
import { useMuteList } from '@/providers/MuteListProvider'
import { useNostr } from '@/providers/NostrProvider'
import client from '@/services/client.service'
import { Bitcoin, Check, Copy, Link, MessageSquare, Zap } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import NotFound from '../NotFound'
import SearchInput from '../SearchInput'
import SpQrCode from '../SpQrCode'
import TextWithEmojis from '../TextWithEmojis'
import TrustScoreBadge from '../TrustScoreBadge'
import AvatarWithLightbox from './AvatarWithLightbox'
import BannerWithLightbox from './BannerWithLightbox'
import FollowedBy from './FollowedBy'
import Followings from './Followings'
import ProfileFeed from './ProfileFeed'
import Relays from './Relays'
import SpecialFollowButton from './SpecialFollowButton'

export default function Profile({ id }: { id?: string }) {
  const { t } = useTranslation()
  const { push } = useSecondaryPage()
  const { profile, isFetching } = useFetchProfile(id)
  const { pubkey: accountPubkey } = useNostr()
  const { mutePubkeySet } = useMuteList()
  const [searchInput, setSearchInput] = useState('')
  const [debouncedInput, setDebouncedInput] = useState(searchInput)
  const { followings } = useFetchFollowings(profile?.pubkey)
  const { canStartDm, isLoading: isDmSupportLoading } = useDmSupport(profile?.pubkey)
  const isFollowingYou = useMemo(() => {
    return (
      !!accountPubkey && accountPubkey !== profile?.pubkey && followings.includes(accountPubkey)
    )
  }, [followings, profile, accountPubkey])
  const isSelf = accountPubkey === profile?.pubkey

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

  if (!profile && isFetching) {
    return (
      <>
        <div>
          <div className="relative mb-2 bg-cover bg-center">
            <Skeleton className="aspect-3/1 w-full rounded-none" />
            <Skeleton className="absolute bottom-0 start-3 h-24 w-24 translate-y-1/2 rounded-full border-4 border-background" />
          </div>
        </div>
        <div className="px-4">
          <Skeleton className="mb-1 mt-14 h-5 w-28" />
          <Skeleton className="my-1 mt-2 h-5 w-56 rounded-full" />
        </div>
      </>
    )
  }
  if (!profile) return <NotFound />

  const { banner, username, about, pubkey, website, lightningAddress, sp, emojis } = profile
  return (
    <>
      <div>
        <div className="relative mb-2 bg-cover bg-center">
          <BannerWithLightbox banner={banner} pubkey={pubkey} />
          <AvatarWithLightbox userId={pubkey} />
        </div>
        <div className="px-4">
          <div className="flex h-8 items-center justify-end gap-2">
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
                <span
                  title={
                    !isDmSupportLoading && !canStartDm
                      ? t('This user has not set up NIP-4e DMs')
                      : undefined
                  }
                  className={!isDmSupportLoading && !canStartDm ? 'cursor-not-allowed' : undefined}
                >
                  <Button
                    variant="secondary"
                    size="icon"
                    className="rounded-full"
                    disabled={isDmSupportLoading || !canStartDm}
                    onClick={() => push(toDmConversation(pubkey))}
                    title={canStartDm ? t('Message') : undefined}
                  >
                    <MessageSquare className="h-4 w-4" />
                  </Button>
                </span>
                <SpecialFollowButton pubkey={pubkey} />
                <FollowButton pubkey={pubkey} />
              </>
            )}
          </div>
          <div className="pt-2">
            <div className="flex items-center gap-2">
              <TextWithEmojis
                text={username}
                emojis={emojis}
                className="select-text truncate text-xl font-semibold"
              />
              <TrustScoreBadge pubkey={pubkey} />
              {isFollowingYou && (
                <div className="h-fit shrink-0 rounded-full bg-muted px-2 text-xs text-muted-foreground">
                  {t('Follows you')}
                </div>
              )}
            </div>
            <Nip05 pubkey={pubkey} />
            {lightningAddress && (
              <div className="flex select-text items-center gap-1 text-sm text-yellow-400">
                <Zap className="size-4 shrink-0" />
                <div className="w-0 max-w-fit flex-1 truncate">{lightningAddress}</div>
              </div>
            )}
            {sp && (
              <div className="flex select-text items-center gap-1 text-sm text-orange-500">
                <Bitcoin className="size-4 shrink-0" />
                <SpCopy sp={sp} />
                <SpQrCode sp={sp} />
              </div>
            )}
            <div className="mt-1 flex gap-1">
              <PubkeyCopy pubkey={pubkey} />
              <NpubQrCode pubkey={pubkey} />
            </div>
            <Collapsible>
              <ProfileAbout
                about={about}
                emojis={emojis}
                className="mt-2 select-text whitespace-pre-wrap text-wrap wrap-break-word"
              />
            </Collapsible>
            {website && (
              <div className="mt-2 flex select-text items-center gap-1 truncate text-primary">
                <Link size={14} className="shrink-0" />
                <a
                  href={website}
                  target="_blank"
                  className="w-0 max-w-fit flex-1 truncate hover:underline"
                >
                  {website}
                </a>
              </div>
            )}
            <div className="mt-2 flex items-center justify-between text-sm">
              <div className="flex items-center gap-4">
                <Followings pubkey={pubkey} />
                <Relays pubkey={pubkey} />
                {isSelf && (
                  <SecondaryPageLink to={toMuteList()} className="flex w-fit gap-1 hover:underline">
                    {mutePubkeySet.size}
                    <div className="text-muted-foreground">{t('Muted')}</div>
                  </SecondaryPageLink>
                )}
              </div>
              {!isSelf && <FollowedBy pubkey={pubkey} />}
            </div>
          </div>
        </div>
        <div className="px-4 pb-0.5 pt-3.5">
          <SearchInput
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={t('Search')}
          />
        </div>
      </div>
      <ProfileFeed pubkey={pubkey} search={debouncedInput} />
    </>
  )
}

function SpCopy({ sp }: { sp: string }) {
  const [copied, setCopied] = useState(false)
  const truncated = sp.length > 24 ? sp.slice(0, 12) + '...' + sp.slice(-6) : sp

  const copy = () => {
    navigator.clipboard.writeText(sp)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="clickable flex w-fit items-center gap-1 font-mono text-xs" onClick={copy}>
      <div>{truncated}</div>
      {copied ? <Check size={14} /> : <Copy size={14} />}
    </div>
  )
}
