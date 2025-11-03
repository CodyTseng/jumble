import { useFetchProfile } from '@/hooks'
import { toProfile } from '@/lib/link'
import { cn } from '@/lib/utils'
import { SecondaryPageLink } from '@/PageManager'
import { TUserActivity } from '@/services/user-activity.service'
import { MessageSquare } from 'lucide-react'
import { SimpleUserAvatar } from '../UserAvatar'

export default function ActiveMemberBadge({
  activity,
  rank,
  className
}: {
  activity: TUserActivity
  rank: number
  className?: string
}) {
  const { profile } = useFetchProfile(activity.pubkey)
  const { username, displayName } = profile || {}

  const displayedName = displayName || username || 'Anonymous'

  return (
    <SecondaryPageLink to={toProfile(activity.pubkey)}>
      <div
        className={cn(
          'flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors clickable',
          className
        )}
      >
        {/* Rank badge */}
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
          <span className="text-sm font-bold text-primary">#{rank}</span>
        </div>

        {/* Avatar */}
        <SimpleUserAvatar userId={activity.pubkey} size="semiBig" className="flex-shrink-0" />

        {/* User info */}
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm truncate">{displayedName}</div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <MessageSquare className="w-3 h-3" />
            <span>{activity.noteCount.toLocaleString()} notes</span>
          </div>
        </div>
      </div>
    </SecondaryPageLink>
  )
}
