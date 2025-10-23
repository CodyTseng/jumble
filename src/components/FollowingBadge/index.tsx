import { userIdToPubkey } from '@/lib/pubkey'
import { useFollowList } from '@/providers/FollowListProvider'
import { UserRoundCheck } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

export default function FollowingBadge({ pubkey, userId }: { pubkey?: string; userId?: string }) {
  const { t } = useTranslation()
  const { followingSet } = useFollowList()
  const isFollowing = useMemo(() => {
    if (pubkey) return followingSet.has(pubkey)

    return userId ? followingSet.has(userIdToPubkey(userId)) : false
  }, [followingSet, pubkey, userId])

  if (!isFollowing) return null

  return (
    <div className="rounded-full bg-muted px-2 py-0.5 flex items-center" title={t('Following')}>
      <UserRoundCheck className="!size-3" />
    </div>
  )
}
