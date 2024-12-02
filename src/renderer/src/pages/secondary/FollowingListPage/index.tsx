import UserItem from '@renderer/components/UserItem'
import { useFetchFollowings, useFetchProfile } from '@renderer/hooks'
import SecondaryPageLayout from '@renderer/layouts/SecondaryPageLayout'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

export default function FollowingListPage({ id }: { id?: string }) {
  const { t } = useTranslation()
  const { profile } = useFetchProfile(id)
  const { followings } = useFetchFollowings(profile?.pubkey)
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
    <SecondaryPageLayout
      titlebarContent={
        profile?.username
          ? t("username's following", { username: profile.username })
          : t('following')
      }
    >
      <div className="space-y-2 max-sm:px-4">
        {visibleFollowings.map((pubkey, index) => (
          <UserItem key={`${index}-${pubkey}`} pubkey={pubkey} />
        ))}
        {followings.length > visibleFollowings.length && <div ref={bottomRef} />}
      </div>
    </SecondaryPageLayout>
  )
}
