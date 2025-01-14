import UserItem from '@/components/UserItem'
import { useFetchFollowings, useFetchProfile } from '@/hooks'
import SecondaryPageLayout from '@/layouts/SecondaryPageLayout'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

export default function FollowingListPage({ id, index }: { id?: string; index?: number }) {
  const { t } = useTranslation()
  const { profile } = useFetchProfile(id)
  const { followings } = useFetchFollowings(profile?.pubkey)
  const [visibleFollowings, setVisibleFollowings] = useState<string[]>([])
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

    const observerInstance = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && followings.length > visibleFollowings.length) {
        setVisibleFollowings((prev) => [
          ...prev,
          ...followings.slice(prev.length, prev.length + 10)
        ])
      }
    }, options)

    const currentBottomRef = bottomRef.current
    if (currentBottomRef) {
      observerInstance.observe(currentBottomRef)
    }

    return () => {
      if (observerInstance && currentBottomRef) {
        observerInstance.unobserve(currentBottomRef)
      }
    }
  }, [visibleFollowings, followings])

  return (
    <SecondaryPageLayout
      index={index}
      title={
        profile?.username
          ? t("username's following", { username: profile.username })
          : t('Following')
      }
      displayScrollToTopButton
    >
      <div className="space-y-2 px-4">
        {visibleFollowings.map((pubkey, index) => (
          <UserItem key={`${index}-${pubkey}`} pubkey={pubkey} />
        ))}
        {followings.length > visibleFollowings.length && <div ref={bottomRef} />}
      </div>
    </SecondaryPageLayout>
  )
}
