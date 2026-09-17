import { useFetchEvent } from '@/hooks/useFetchEvent'
import SecondaryPageLayout from '@/layouts/SecondaryPageLayout'
import LongFormEditorPage from '@/pages/primary/LongFormEditorPage'
import { useNostr } from '@/providers/NostrProvider'
import { TPageRef } from '@/types'
import { Event, kinds } from 'nostr-tools'
import { forwardRef, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import NotFound from '../NotePage/NotFound'

const ArticleEditorPage = forwardRef<TPageRef, { id?: string; index?: number }>(
  ({ id, index = 0 }, ref) => {
    const { t } = useTranslation()
    const { pubkey } = useNostr()
    const { event, isFetching } = useFetchEvent(id)
    // Editing is based on a fixed version. A publish notification must not
    // replace the draft while the successful publish is returning to its source page.
    const source = useRef<{ id: string | undefined; event: Event }>()
    if (event && source.current?.id !== id) source.current = { id, event }
    const editEvent = source.current?.id === id ? source.current?.event : undefined

    if (!id) return <LongFormEditorPage ref={ref} index={index} />

    if (editEvent?.kind === kinds.LongFormArticle && editEvent.pubkey === pubkey) {
      return <LongFormEditorPage ref={ref} editEvent={editEvent} index={index} />
    }
    return (
      <SecondaryPageLayout ref={ref} index={index} title={t('Edit')}>
        {!isFetching && <NotFound />}
      </SecondaryPageLayout>
    )
  }
)

export default ArticleEditorPage
