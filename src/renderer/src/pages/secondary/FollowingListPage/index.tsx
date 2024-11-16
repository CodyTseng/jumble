import FollowButton from '@renderer/components/FollowButton'
import Nip05 from '@renderer/components/Nip05'
import UserAvatar from '@renderer/components/UserAvatar'
import Username from '@renderer/components/Username'
import { useFetchFollowings, useFetchProfile } from '@renderer/hooks'
import SecondaryPageLayout from '@renderer/layouts/SecondaryPageLayout'
import { useEffect, useRef, useState } from 'react'

export default function FollowingListPage({ id }: { id?: string }) {
  const {
    profile: { username, pubkey }
  } = useFetchProfile(id)
  const { followings } = useFetchFollowings(pubkey)
  const [visibleFollowings, setVisibleFollowings] = useState<string[]>([])
  const observer = useRef<IntersectionObserver | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setVisibleFollowings(followings.slice(0, 10))
  }, [followings])

  useEffect(() => {
    const options = {
      root: null,
      rootMargin: '10px',
      threshold: 1
    }

    observer.current = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && followings.length > visibleFollowings.length) {
        setVisibleFollowings((prev) => [
          ...prev,
          ...followings.slice(prev.length, prev.length + 10)
        ])
      }
    }, options)

    if (bottomRef.current) {
      observer.current.observe(bottomRef.current)
    }

    return () => {
      if (observer.current && bottomRef.current) {
        observer.current.unobserve(bottomRef.current)
      }
    }
  }, [visibleFollowings])

  return (
    <SecondaryPageLayout titlebarContent={username ? `${username}'s following` : 'following'}>
      <div className="space-y-2">
        {visibleFollowings.map((pubkey, index) => (
          <FollowingItem key={`${index}-${pubkey}`} pubkey={pubkey} />
        ))}
        {followings.length > visibleFollowings.length && <div ref={bottomRef} />}
      </div>
    </SecondaryPageLayout>
  )
}

function FollowingItem({ pubkey }: { pubkey: string }) {
  const {
    profile: { about, nip05 }
  } = useFetchProfile(pubkey)

  return (
    <div className="flex gap-2 items-start">
      <UserAvatar userId={pubkey} />
      <div className="w-full overflow-hidden">
        <Username userId={pubkey} className="font-semibold truncate" />
        <Nip05 nip05={nip05} pubkey={pubkey} />
        <div className="truncate text-muted-foreground text-sm">{about}</div>
      </div>
      <FollowButton pubkey={pubkey} />
    </div>
  )
}
