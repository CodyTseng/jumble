import { Separator } from '@/components/ui/separator'
import { Event } from 'nostr-tools'
import { useState } from 'react'
import HideUntrustedContentButton from '../HideUntrustedContentButton'
import QuoteList from '../QuoteList'
import ReplyNoteList from '../ReplyNoteList'
import ReactionList from '../ReactionList'
import { Tabs, TTabValue } from './Tabs'

export default function NoteInteractions({
  pageIndex,
  event
}: {
  pageIndex?: number
  event: Event
}) {
  const [type, setType] = useState<TTabValue>('replies')
  let list
  switch (type) {
    case 'replies':
      list = <ReplyNoteList index={pageIndex} event={event} />
      break
    case 'quotes':
      list = <QuoteList event={event} />
      break
    case 'reactions':
      list = <ReactionList index={pageIndex} event={event} />
      break
    default:
      break
  }

  return (
    <>
      <div className="flex items-center justify-between pr-1">
        <Tabs selectedTab={type} onTabChange={setType} />
        <HideUntrustedContentButton type="interactions" />
      </div>
      <Separator />
      {list}
    </>
  )
}
