import { Skeleton } from '@/components/ui/skeleton'
import { useFetchProfile } from '@/hooks'
import { generateImageByPubkey } from '@/lib/pubkey'
import { useMemo } from 'react'
import ImageWithLightbox from '../ImageWithLightbox'

export default function AvatarWithLightbox({ userId }: { userId: string }) {
  const { profile } = useFetchProfile(userId)
  const defaultAvatar = useMemo(
    () => (profile?.pubkey ? generateImageByPubkey(profile.pubkey) : ''),
    [profile]
  )

  if (!profile) {
    return (
      <Skeleton className="absolute bottom-0 start-3 h-24 w-24 shrink-0 translate-y-1/2 rounded-full border-4 border-background" />
    )
  }
  const { avatar, pubkey } = profile || {}

  return (
    <ImageWithLightbox
      image={{ url: avatar ?? defaultAvatar, pubkey }}
      errorPlaceholder={defaultAvatar}
      className="object-cover object-center"
      classNames={{
        wrapper:
          'shrink-0 rounded-full bg-background w-24 h-24 absolute start-3 bottom-0 translate-y-1/2 border-4 border-background'
      }}
      ignoreAutoLoadPolicy
    />
  )
}
