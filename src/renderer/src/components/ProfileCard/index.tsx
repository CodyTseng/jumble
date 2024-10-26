import { Avatar, AvatarFallback, AvatarImage } from '@renderer/components/ui/avatar'
import { generateImageByPubkey } from '@renderer/lib/pubkey'
import { useFetchProfile } from '@renderer/hooks'
import Nip05 from '../Nip05'
import ProfileAbout from '../ProfileAbout'

export default function ProfileCard({ pubkey }: { pubkey: string }) {
  const { avatar = '', username, nip05, about } = useFetchProfile(pubkey)
  const defaultAvatar = generateImageByPubkey(pubkey)

  return (
    <div className="w-full flex flex-col gap-2">
      <div className="flex space-x-2 w-full items-center">
        <Avatar className="w-12 h-12">
          <AvatarImage src={avatar} />
          <AvatarFallback>
            <img src={defaultAvatar} alt={pubkey} />
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 w-0">
          <div className="text-lg font-semibold truncate">{username}</div>
          {nip05 && <Nip05 nip05={nip05} pubkey={pubkey} />}
        </div>
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
