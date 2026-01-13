import { useFetchProfile } from '@/hooks'
import { userIdToPubkey } from '@/lib/pubkey'
import { useMemo } from 'react'
import FollowButton from '../FollowButton'
import Nip05 from '../Nip05'
import ProfileAbout from '../ProfileAbout'
import TextWithEmojis from '../TextWithEmojis'
import TrustScoreBadge from '../TrustScoreBadge'
import { SimpleUserAvatar } from '../UserAvatar'

export default function ProfileCard({ userId }: { userId: string }) {
  const pubkey = useMemo(() => userIdToPubkey(userId), [userId])
  const { profile } = useFetchProfile(userId)
  const { username, about, emojis } = profile || {}

  return (
    <div className="w-full flex flex-col gap-2 not-prose">
      <div className="flex space-x-2 w-full items-start justify-between">
        <SimpleUserAvatar userId={pubkey} className="w-12 h-12" />
        <FollowButton pubkey={pubkey} />
      </div>
      <div>
        <div className="flex gap-2 items-center">
          <TextWithEmojis
            text={username || ''}
            emojis={emojis}
            className="text-lg font-semibold truncate"
          />
          <TrustScoreBadge pubkey={pubkey} />
        </div>
        <Nip05 pubkey={pubkey} />
      </div>
      {about && (
        <ProfileAbout
          about={about}
          emojis={emojis}
          className="text-sm text-wrap break-words w-full overflow-hidden text-ellipsis line-clamp-6"
        />
      )}
    </div>
  )
}
