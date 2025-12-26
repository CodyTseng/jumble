import NoteCard from '@/components/NoteCard'
import { SimpleUsername } from '@/components/Username'
import SecondaryPageLayout from '@/layouts/SecondaryPageLayout'
import userAggregationService from '@/services/user-aggregation.service'
import { nip19, NostrEvent } from 'nostr-tools'
import { forwardRef, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

const UserAggregationDetailPage = forwardRef(
  (
    {
      feedId,
      pubkey: pubkeyParam,
      index
    }: {
      feedId?: string
      pubkey?: string
      index?: number
    },
    ref
  ) => {
    const { t } = useTranslation()
    const [aggregation, setAggregation] = useState<NostrEvent[]>([])

    const pubkey = useMemo(() => {
      if (!pubkeyParam) return undefined
      try {
        const { type, data } = nip19.decode(pubkeyParam)
        if (type === 'npub') return data
        if (type === 'nprofile') return data.pubkey
      } catch {
        return undefined
      }
    }, [pubkeyParam])

    useEffect(() => {
      if (!feedId || !pubkey) {
        setAggregation([])
        return
      }

      const updateEvents = () => {
        const events = userAggregationService.getAggregation(feedId, pubkey)
        setAggregation(events)
      }

      const unSub = userAggregationService.subscribeAggregationChange(feedId, pubkey, () => {
        updateEvents()
      })

      updateEvents()

      return unSub
    }, [feedId, pubkey, setAggregation])

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
          {aggregation.map((event) => (
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
