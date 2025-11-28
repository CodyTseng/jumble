import NoteCard from '@/components/NoteCard'
import { SimpleUsername } from '@/components/Username'
import SecondaryPageLayout from '@/layouts/SecondaryPageLayout'
import userAggregationService from '@/services/user-aggregation.service'
import { nip19 } from 'nostr-tools'
import { forwardRef, useMemo } from 'react'
import { useTranslation } from 'react-i18next'

const UserAggregationDetailPage = forwardRef(
  (
    {
      feedId,
      npub,
      index
    }: {
      feedId?: string
      npub?: string
      index?: number
    },
    ref
  ) => {
    const { t } = useTranslation()

    const pubkey = useMemo(() => {
      if (!npub) return undefined
      try {
        const { type, data } = nip19.decode(npub)
        if (type === 'npub') return data
        if (type === 'nprofile') return data.pubkey
      } catch {
        return undefined
      }
    }, [npub])

    const userEvents = useMemo(() => {
      if (!feedId || !pubkey) return []
      return userAggregationService.getUserEvents(feedId, pubkey)
    }, [feedId, pubkey])

    if (!pubkey || !feedId) {
      return (
        <SecondaryPageLayout ref={ref} index={index} title={t('User Posts')}>
          <div className="flex justify-center items-center h-40 text-muted-foreground">
            {t('Invalid user')}
          </div>
        </SecondaryPageLayout>
      )
    }

    return (
      <SecondaryPageLayout
        ref={ref}
        index={index}
        title={<SimpleUsername userId={pubkey} className="truncate" />}
        displayScrollToTopButton
      >
        <div className="min-h-screen">
          {userEvents.map((event) => (
            <NoteCard key={event.id} className="w-full" event={event} filterMutedNotes={false} />
          ))}
          <div className="text-center text-sm text-muted-foreground mt-2">{t('no more notes')}</div>
        </div>
      </SecondaryPageLayout>
    )
  }
)

UserAggregationDetailPage.displayName = 'UserAggregationDetailPage'

export default UserAggregationDetailPage
