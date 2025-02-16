import FollowButton from '@/components/FollowButton'
import Nip05 from '@/components/Nip05'
import UserAvatar from '@/components/UserAvatar'
import Username from '@/components/Username'
import { useFetchProfile } from '@/hooks'

export default function UserItem({ pubkey }: { pubkey: string }) {
  const { profile } = useFetchProfile(pubkey)

  return (
    <div className="flex gap-2 items-start">
      <UserAvatar userId={pubkey} className="shrink-0" />
      <div className="w-full overflow-hidden">
        <Username
          userId={pubkey}
          className="font-semibold truncate max-w-full w-fit"
          skeletonClassName="h-4"
        />
        <Nip05 pubkey={pubkey} />
        <div className="truncate text-muted-foreground text-sm">{profile?.about}</div>
      </div>
      <FollowButton pubkey={pubkey} />
    </div>
  )
}
