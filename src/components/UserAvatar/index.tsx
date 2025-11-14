import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card'
import { Skeleton } from '@/components/ui/skeleton'
import { useFetchProfile } from '@/hooks'
import { toProfile } from '@/lib/link'
import { generateImageByPubkey } from '@/lib/pubkey'
import { randomString } from '@/lib/random'
import { cn } from '@/lib/utils'
import { SecondaryPageLink } from '@/PageManager'
import modalManager from '@/services/modal-manager.service'
import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import Lightbox from 'yet-another-react-lightbox'
import Zoom from 'yet-another-react-lightbox/plugins/zoom'
import Image from '../Image'
import ProfileCard from '../ProfileCard'

const UserAvatarSizeCnMap = {
  large: 'w-24 h-24',
  big: 'w-16 h-16',
  semiBig: 'w-12 h-12',
  normal: 'w-10 h-10',
  medium: 'w-9 h-9',
  small: 'w-7 h-7',
  xSmall: 'w-5 h-5',
  tiny: 'w-4 h-4'
}

export default function UserAvatar({
  userId,
  className,
  size = 'normal'
}: {
  userId: string
  className?: string
  size?: 'large' | 'big' | 'semiBig' | 'normal' | 'medium' | 'small' | 'xSmall' | 'tiny'
}) {
  return (
    <HoverCard>
      <HoverCardTrigger>
        <SecondaryPageLink to={toProfile(userId)} onClick={(e) => e.stopPropagation()}>
          <SimpleUserAvatar userId={userId} size={size} className={className} />
        </SecondaryPageLink>
      </HoverCardTrigger>
      <HoverCardContent className="w-72">
        <ProfileCard userId={userId} />
      </HoverCardContent>
    </HoverCard>
  )
}

export function SimpleUserAvatar({
  userId,
  size = 'normal',
  className,
  onClick
}: {
  userId: string
  size?: 'large' | 'big' | 'semiBig' | 'normal' | 'medium' | 'small' | 'xSmall' | 'tiny'
  className?: string
  onClick?: (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => void
}) {
  const { profile } = useFetchProfile(userId)
  const defaultAvatar = useMemo(
    () => (profile?.pubkey ? generateImageByPubkey(profile.pubkey) : ''),
    [profile]
  )

  if (!profile) {
    return (
      <Skeleton className={cn('shrink-0', UserAvatarSizeCnMap[size], 'rounded-full', className)} />
    )
  }
  const { avatar, pubkey } = profile || {}

  return (
    <Image
      image={{ url: avatar ?? defaultAvatar, pubkey }}
      errorPlaceholder={defaultAvatar}
      className="object-cover object-center"
      classNames={{
        wrapper: cn('shrink-0 rounded-full bg-background', UserAvatarSizeCnMap[size], className)
      }}
      onClick={onClick}
    />
  )
}

export function AvatarWithLightbox({
  userId,
  size = 'normal',
  className
}: {
  userId: string
  size?: 'large' | 'big' | 'semiBig' | 'normal' | 'medium' | 'small' | 'xSmall' | 'tiny'
  className?: string
}) {
  const id = useMemo(() => `user-avatar-lightbox-${randomString()}`, [])
  const { profile } = useFetchProfile(userId)
  const defaultAvatar = useMemo(
    () => (profile?.pubkey ? generateImageByPubkey(profile.pubkey) : ''),
    [profile]
  )
  const [index, setIndex] = useState(-1)

  useEffect(() => {
    if (index >= 0) {
      modalManager.register(id, () => {
        setIndex(-1)
      })
    } else {
      modalManager.unregister(id)
    }
  }, [index, id])

  const handleClick = (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    e.stopPropagation()
    e.preventDefault()
    setIndex(0)
  }

  const imageUrl = profile?.avatar ?? defaultAvatar

  return (
    <>
      <SimpleUserAvatar
        userId={userId}
        size={size}
        className={cn('cursor-zoom-in', className)}
        onClick={handleClick}
      />
      {index >= 0 &&
        createPortal(
          <div onClick={(e) => e.stopPropagation()}>
            <Lightbox
              index={index}
              slides={[{ src: imageUrl }]}
              plugins={[Zoom]}
              open={index >= 0}
              close={() => setIndex(-1)}
              controller={{
                closeOnBackdropClick: true,
                closeOnPullUp: true,
                closeOnPullDown: true
              }}
              styles={{
                toolbar: { paddingTop: '2.25rem' }
              }}
            />
          </div>,
          document.body
        )}
    </>
  )
}
