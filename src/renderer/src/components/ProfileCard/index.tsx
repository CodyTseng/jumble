import { Avatar, AvatarFallback, AvatarImage } from '@renderer/components/ui/avatar'
import { useFetchProfile } from '@renderer/hooks'
import { generateImageByPubkey } from '@renderer/lib/pubkey'
import { useMemo } from 'react'
import FollowButton from '../FollowButton'
import Nip05 from '../Nip05'
import ProfileAbout from '../ProfileAbout'

export default function ProfileCard({ pubkey }: { pubkey: string }) {
  const {
    profile: { avatar = '', username, nip05, about }
  } = useFetchProfile(pubkey)
  const defaultImage = useMemo(() => generateImageByPubkey(pubkey), [pubkey])

  return (
    <div className="w-full flex flex-col gap-2">
      <div className="flex space-x-2 w-full items-start justify-between">
        <Avatar className="w-12 h-12">
          <AvatarImage className="object-cover object-center" src={avatar} />
          <AvatarFallback>
            <img src={defaultImage} alt={pubkey} />
          </AvatarFallback>
        </Avatar>
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
