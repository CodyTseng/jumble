import FollowButton from '@/components/FollowButton'
import Nip05 from '@/components/Nip05'
import UserAvatar, { UserAvatarSkeleton } from '@/components/UserAvatar'
import Username from '@/components/Username'
import { Skeleton } from '@/components/ui/skeleton'
import { userIdToPubkey } from '@/lib/pubkey'
import { cn } from '@/lib/utils'
import { useMemo } from 'react'
import FollowingBadge from '../FollowingBadge'
import TrustScoreBadge from '../TrustScoreBadge'

export default function UserItem({
  userId,
  hideFollowButton,
  showFollowingBadge = false,
  className
}: {
  userId: string
  hideFollowButton?: boolean
  showFollowingBadge?: boolean
  className?: string
}) {
  const pubkey = useMemo(() => userIdToPubkey(userId), [userId])

  return (
    <div className={cn('flex h-14 items-center gap-2', className)}>
      <UserAvatar userId={userId} className="shrink-0" />
      <div className="w-full overflow-hidden">
        <div className="flex items-center gap-2">
          <Username
            userId={userId}
            className="w-fit max-w-full truncate font-semibold"
            skeletonClassName="h-4"
          />
          {showFollowingBadge && <FollowingBadge pubkey={pubkey} />}
          <TrustScoreBadge pubkey={pubkey} />
        </div>
        <Nip05 pubkey={userId} />
      </div>
      {!hideFollowButton && <FollowButton pubkey={userId} />}
    </div>
  )
}

export function UserItemSkeleton({ hideFollowButton }: { hideFollowButton?: boolean }) {
  return (
    <div className="flex h-14 items-center gap-2">
      <UserAvatarSkeleton className="h-10 w-10" />
      <div className="w-full">
        <div className="py-1">
          <Skeleton className="h-4 w-16" />
        </div>
      </div>
      {!hideFollowButton && <Skeleton className="h-9 min-w-28 rounded-full" />}
    </div>
  )
}
