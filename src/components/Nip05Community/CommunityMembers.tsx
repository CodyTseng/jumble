import { toProfile } from '@/lib/link'
import { useSecondaryPage } from '@/PageManager'
import { useFetchProfile } from '@/hooks'
import { SimpleUserAvatar } from '../UserAvatar'
import { Skeleton } from '../ui/skeleton'
import { useTranslation } from 'react-i18next'
import { useState, useEffect, useRef } from 'react'

const SHOW_COUNT = 20

export default function CommunityMembers({ members, domain }: { members: string[]; domain: string }) {
  const { t } = useTranslation()
  const [showCount, setShowCount] = useState(SHOW_COUNT)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const options = {
      root: null,
      rootMargin: '10px',
      threshold: 1
    }

    const observerInstance = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting && showCount < members.length) {
        setShowCount((prev) => prev + SHOW_COUNT)
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
  }, [showCount, members.length])

  if (!members || members.length === 0) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        {t('No members found')}
      </div>
    )
  }

  return (
    <div>
      <div className="px-4 py-2 text-sm text-muted-foreground">
        {t('n members', { n: members.length })}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 px-4 pb-4">
        {members.slice(0, showCount).map((pubkey) => (
          <MemberCard key={pubkey} pubkey={pubkey} domain={domain} />
        ))}
      </div>
      {showCount < members.length && <div ref={bottomRef} className="h-4" />}
      {showCount >= members.length && (
        <div className="text-center text-muted-foreground text-sm pb-4">
          {t('no more members')}
        </div>
      )}
    </div>
  )
}

function MemberCard({ pubkey, domain }: { pubkey: string; domain: string }) {
  const { push } = useSecondaryPage()
  const { profile, isFetching } = useFetchProfile(pubkey)

  if (isFetching) {
    return (
      <div className="flex items-center gap-3 p-3 border rounded-lg">
        <Skeleton className="w-12 h-12 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3 w-32" />
        </div>
      </div>
    )
  }

  const displayName = profile?.username || pubkey.slice(0, 8)
  const nip05 = profile?.nip05

  return (
    <div
      className="flex items-center gap-3 p-3 border rounded-lg clickable hover:bg-muted/50 transition-colors"
      onClick={() => push(toProfile(pubkey))}
    >
      <SimpleUserAvatar userId={pubkey} className="w-12 h-12" />
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate">{displayName}</div>
        {nip05 && (
          <div className="text-xs text-muted-foreground truncate">
            {nip05.endsWith(`@${domain}`) ? nip05.replace(`@${domain}`, '') : nip05}@{domain}
          </div>
        )}
        {!nip05 && (
          <div className="text-xs text-muted-foreground truncate">{pubkey.slice(0, 16)}...</div>
        )}
      </div>
    </div>
  )
}
