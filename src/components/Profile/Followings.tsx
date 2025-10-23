import { useFetchFollowings } from '@/hooks'
import { toFollowingList } from '@/lib/link'
import { SecondaryPageLink } from '@/PageManager'
import { useFollowList } from '@/providers/FollowListProvider'
import { useNostr } from '@/providers/NostrProvider'
import { Loader } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export default function Followings({ pubkey }: { pubkey: string }) {
  const { t } = useTranslation()
  const { pubkey: accountPubkey } = useNostr()
  const { followingSet: selfFollowingSet } = useFollowList()
  const { followings, isFetching } = useFetchFollowings(pubkey)

  return (
    <SecondaryPageLink
      to={toFollowingList(pubkey)}
      className="flex gap-1 hover:underline w-fit items-center"
    >
      {accountPubkey === pubkey ? (
        selfFollowingSet.size
      ) : isFetching ? (
        <Loader className="animate-spin size-4" />
      ) : (
        followings.length
      )}
      <div className="text-muted-foreground">{t('Following')}</div>
    </SecondaryPageLink>
  )
}
