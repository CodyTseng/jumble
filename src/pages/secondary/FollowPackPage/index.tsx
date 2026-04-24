import ImageWithLightbox from '@/components/ImageWithLightbox'
import NormalFeed from '@/components/NormalFeed'
import ProfileList from '@/components/ProfileList'
import { Skeleton } from '@/components/ui/skeleton'
import { useFetchEvent } from '@/hooks/useFetchEvent'
import SecondaryPageLayout from '@/layouts/SecondaryPageLayout'
import { getEventKey } from '@/lib/event'
import { getFollowPackInfoFromEvent } from '@/lib/event-metadata'
import { cn } from '@/lib/utils'
import { useNostr } from '@/providers/NostrProvider'
import client from '@/services/client.service'
import { TFeedSubRequest } from '@/types'
import { forwardRef, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

const FollowPackPage = forwardRef(({ id, index }: { id?: string; index?: number }, ref) => {
  const { t } = useTranslation()
  const [tab, setTab] = useState<'users' | 'feed'>('users')

  const { event, isFetching } = useFetchEvent(id)

  const { title, description, image, pubkeys } = useMemo(() => {
    if (!event) return { title: '', description: '', image: '', pubkeys: [] }
    return getFollowPackInfoFromEvent(event)
  }, [event])

  if (isFetching) {
    return (
      <SecondaryPageLayout ref={ref} index={index} title={t('Follow Pack')}>
        <div className="space-y-2 px-4 py-3">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-7 w-full py-1" />
        </div>
      </SecondaryPageLayout>
    )
  }

  if (!event) {
    return (
      <SecondaryPageLayout ref={ref} index={index} title={t('Follow Pack')}>
        <div className="p-4 text-center text-muted-foreground">{t('Follow pack not found')}</div>
      </SecondaryPageLayout>
    )
  }

  return (
    <SecondaryPageLayout ref={ref} index={index} title={t('Follow Pack')} displayScrollToTopButton>
      <div>
        {/* Header */}
        <div className="space-y-2 px-4 pt-3">
          {image && (
            <ImageWithLightbox
              image={{ url: image, pubkey: event.pubkey }}
              className="h-48 w-full rounded-lg object-cover"
              classNames={{
                wrapper: 'w-full h-48 border-none'
              }}
            />
          )}

          <div className="flex items-center gap-2">
            <h3 className="mb-1 truncate text-2xl font-semibold">{title}</h3>
            <span className="shrink-0 text-xs text-muted-foreground">
              {t('n users', { count: pubkeys.length })}
            </span>
          </div>

          {description && (
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">{description}</p>
          )}

          <div className="inline-flex items-center rounded-lg border bg-muted/50">
            <button
              onClick={() => setTab('users')}
              className={cn(
                'rounded-s-lg px-3 py-1.5 text-sm font-medium transition-colors',
                tab === 'users'
                  ? 'bg-background text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {t('Users')}
            </button>
            <button
              onClick={() => setTab('feed')}
              className={cn(
                'rounded-e-lg px-3 py-1.5 text-sm font-medium transition-colors',
                tab === 'feed'
                  ? 'bg-background text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {t('Feed')}
            </button>
          </div>
        </div>

        {/* Content */}
        {tab === 'users' && <ProfileList pubkeys={pubkeys} />}
        {tab === 'feed' && pubkeys.length > 0 && (
          <Feed feedId={`follow-pack-${getEventKey(event)}`} pubkeys={pubkeys} />
        )}
      </div>
    </SecondaryPageLayout>
  )
})
FollowPackPage.displayName = 'FollowPackPage'
export default FollowPackPage

function Feed({ feedId, pubkeys }: { feedId: string; pubkeys: string[] }) {
  const { pubkey: myPubkey } = useNostr()
  const [subRequests, setSubRequests] = useState<TFeedSubRequest[]>([])

  useEffect(() => {
    client.generateSubRequestsForPubkeys(pubkeys, myPubkey).then(setSubRequests)
  }, [pubkeys, myPubkey])

  return <NormalFeed feedId={feedId} subRequests={subRequests} />
}
