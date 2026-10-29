import { useFetchProfile } from '@/hooks'
import { toProfile } from '@/lib/link'
import { userIdToPubkey } from '@/lib/pubkey'
import { useSecondaryPage } from '@/PageManager'
import { useContentPolicy } from '@/providers/ContentPolicyProvider'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import FollowButton from '../FollowButton'
import Nip05 from '../Nip05'
import ProfileAbout from '../ProfileAbout'
import TextWithEmojis from '../TextWithEmojis'
import TrustScoreBadge from '../TrustScoreBadge'
import { SimpleUserAvatar } from '../UserAvatar'

export default function ProfileCard({ userId }: { userId: string }) {
  const { push } = useSecondaryPage()
  const { t } = useTranslation()
  const pubkey = useMemo(() => userIdToPubkey(userId), [userId])
  const { profile } = useFetchProfile(userId)
  const { autoLoadProfilePicture } = useContentPolicy()
  const { username, about, emojis } = profile || {}

  return (
    <div className="not-prose flex w-full flex-col gap-2">
      {autoLoadProfilePicture && (
        <div className="flex w-full items-start justify-between gap-2">
          <button
            type="button"
            aria-label={t('Profile')}
            className="focus-visible:outline-ring shrink-0 cursor-pointer rounded-full focus-visible:outline-2 focus-visible:outline-offset-2"
            onClick={() => push(toProfile(userId))}
          >
            <SimpleUserAvatar userId={pubkey} className="h-12 w-12" />
          </button>
          <FollowButton pubkey={pubkey} />
        </div>
      )}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <TextWithEmojis
              text={username || ''}
              emojis={emojis}
              className="truncate text-lg font-semibold"
            />
            <TrustScoreBadge pubkey={pubkey} />
          </div>
          <Nip05 pubkey={pubkey} />
        </div>
        {!autoLoadProfilePicture && <FollowButton pubkey={pubkey} />}
      </div>
      {about && (
        <ProfileAbout
          about={about}
          emojis={emojis}
          className="line-clamp-6 w-full overflow-hidden text-sm text-wrap wrap-break-word text-ellipsis"
        />
      )}
    </div>
  )
}
