import FollowButton from '@/components/FollowButton'
import Nip05 from '@/components/Nip05'
import UserAvatar from '@/components/UserAvatar'
import Username from '@/components/Username'
import { Skeleton } from '@/components/ui/skeleton'
import { userIdToPubkey } from '@/lib/pubkey'
import { cn } from '@/lib/utils'
import { useMemo } from 'react'
import FollowingBadge from '../FollowingBadge'

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
    <div className={cn('flex gap-2 items-center h-14', className)}>
      <UserAvatar userId={userId} className="shrink-0" />
      <div className="w-full overflow-hidden">
        <div className="flex items-center gap-2">
          <Username
            userId={userId}
            className="font-semibold truncate max-w-full w-fit"
            skeletonClassName="h-4"
          />
          {showFollowingBadge && <FollowingBadge pubkey={pubkey} />}
        </div>
        <Nip05 pubkey={userId} />
      </div>
      {!hideFollowButton && <FollowButton pubkey={userId} />}
    </div>
  )
}

export function UserItemSkeleton({ hideFollowButton }: { hideFollowButton?: boolean }) {
  return (
    <div className="flex gap-2 items-center h-14">
      <Skeleton className="w-10 h-10 rounded-full shrink-0" />
      <div className="w-full">
        <div className="py-1">
          <Skeleton className="w-16 h-4" />
        </div>
      </div>
      {!hideFollowButton && <Skeleton className="rounded-full min-w-28 h-9" />}
    </div>
  )
}
