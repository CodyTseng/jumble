import { useFetchProfile } from '@/hooks'
import FollowButton from '../FollowButton'
import Nip05 from '../Nip05'
import ProfileAbout from '../ProfileAbout'
import { SimpleUserAvatar } from '../UserAvatar'

export default function ProfileCard({ pubkey }: { pubkey: string }) {
  const { profile } = useFetchProfile(pubkey)
  const { username, nip05, about } = profile || {}

  return (
    <div className="w-full flex flex-col gap-2">
      <div className="flex space-x-2 w-full items-start justify-between">
        <SimpleUserAvatar userId={pubkey} className="w-12 h-12" />
        <FollowButton pubkey={pubkey} />
      </div>
      <div>
        <div className="text-lg font-semibold truncate">{username}</div>
        {nip05 && <Nip05 nip05={nip05} pubkey={pubkey} />}
      </div>
      {about && (
        <div
          className="text-sm text-wrap break-words w-full overflow-hidden text-ellipsis"
          style={{ display: '-webkit-box', WebkitLineClamp: 6, WebkitBoxOrient: 'vertical' }}
        >
          <ProfileAbout about={about} />
        </div>
      )}
    </div>
  )
}
