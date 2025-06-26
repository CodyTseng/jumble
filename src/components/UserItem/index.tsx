import FollowButton from '@/components/FollowButton'
import Nip05 from '@/components/Nip05'
import UserAvatar from '@/components/UserAvatar'
import Username from '@/components/Username'

export default function UserItem({ pubkey }: { pubkey: string }) {
  return (
    <div className="flex gap-2 items-center h-14">
      <UserAvatar userId={pubkey} className="shrink-0" />
      <div className="w-full overflow-hidden">
        <Username
          userId={pubkey}
          className="font-semibold truncate max-w-full w-fit"
          skeletonClassName="h-4"
        />
        <Nip05 pubkey={pubkey} />
      </div>
      <FollowButton pubkey={pubkey} />
    </div>
  )
}
